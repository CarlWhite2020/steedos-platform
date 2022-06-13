/*
 * @Author: sunhaolin@hotoa.com
 * @Date: 2022-06-09 09:36:43
 * @LastEditors: sunhaolin@hotoa.com
 * @LastEditTime: 2022-06-12 16:26:16
 * @Description: 文件类，处理文件保存
 */
'use strict';
// @ts-check

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const {
    _makeNewID,
    getStoreName,
    storageBasePath,
    fileStoreFullPath,
    getS3FoldOption,
    getS3BucketOption,
    getCloudFoldOption,
    getCloudBucketOption,
    getCloudApikey,
} = require('./util');
const {
    LOCAL_STORE,
    OSS_STORE,
    S3_STORE,
    STEEDOSCLOUD_STORE
} = require('./consts');
// 扫描病毒的命令，如未配置则认为无需扫描
const VIRUS_SCAN_SCAN_COMMAND = process.env.VIRUS_SCAN_SCAN_COMMAND;
const objectql = require('@steedos/objectql')

class File {

    constructor({ name, size, mimetype, fsCollectionName }) {
        this._id = _makeNewID();
        this._name = name;
        this._size = size;
        this._mimetype = mimetype;

        this._fsCollectionName = fsCollectionName;
    }

    /**
     * @param {any} metadata
     {
        approve,
        instance,
        is_private,
        owner,
        owner_name,
        space,
        upload_from,
        isAddVersion,
        parent,
        main,
        locked_by,
        locked_by_name,
        overwrite,
        current
     }
     */
    set metadata(metadata) {
        this._metadata = metadata;
        this._fileKey = this.fileKeyMaker({ _id: this._id, filename: this._name, instance: metadata.instance, fsCollectionName: this._fsCollectionName });
    }

    /**
     * @returns {String}
     */
    get name() {
        return this._name;
    }

    /**
     * @returns {String}
     */
    get id() {
        return this._id;
    }

    /**
     * 获取文件新增所需信息
     * @returns {any}
     */
    insertDoc() {
        const now = new Date();
        const _id = this._id;
        const filename = this._name;
        const mimetype = this._mimetype;
        const size = this._size;
        const fsCollectionName = this._fsCollectionName;
        const metadata = this._metadata;
        const fileKey = this._fileKey;

        const doc = {
            "_id": _id,
            "original": {
                "type": mimetype,
                "size": size,
                "name": filename
            },
            "metadata": metadata,
            "uploadedAt": now,
            "copies": {
                [fsCollectionName]: {
                    "name": filename,
                    "type": mimetype,
                    "size": size,
                    "key": fileKey,
                    "updatedAt": now,
                    "createdAt": now
                }
            }
        };

        return doc;
    }

    /**
     * 生成文件存储路径后缀
     * @param {{ _id, filename, instance, fsCollectionName }} param0 
     * @returns 
     */
    fileKeyMaker({ _id, filename, instance, fsCollectionName }) {

        const storeName = getStoreName();

        const name_split = filename.split('.');
        const extention = name_split.pop();
        const final_filename = name_split.join('.').substring(0, 50) + '.' + extention;

        if ('local' === storeName) {
            const now = new Date;
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            let customPathPrefix = year + '/' + month + '/';
            if (instance) {
                customPathPrefix += instance;
            }

            const pathname = path.join(storageBasePath(fsCollectionName), customPathPrefix);

            const absolutePath = path.resolve(pathname);
            // 如果文件夹不存在，则创建文件夹
            mkdirp.sync(absolutePath);

            return customPathPrefix + '/' + fsCollectionName + '-' + _id + '-' + final_filename;
        }
        else {
            return fsCollectionName + '/' + fsCollectionName + '-' + _id + '-' + final_filename;
        }

    }


    /**
     * 保存文件
     * @param {*} tempFilePath 
     * @param {*} callback 
     */
    async save(tempFilePath, callback) {
        try {
            const storeName = getStoreName();
            const fsCollectionName = this._fsCollectionName;
            const fileKey = this._fileKey;
            if (LOCAL_STORE === storeName) {
                const fileStorePath = fileStoreFullPath(fsCollectionName, fileKey);
                // 使用clamdscan扫描病毒
                if (VIRUS_SCAN_SCAN_COMMAND) {
                    try {
                        await objectql.getSteedosSchema().broker.call('~packages-@steedos/ee_virus-scan.execScanCommand', { command: VIRUS_SCAN_SCAN_COMMAND, filePath: tempFilePath})
                    } catch (error) {
                        fs.unlinkSync(tempFilePath);
                        console.error(error);
                        // 根据status判断是否是被感染文件
                        if (error.status === 1) {
                            error.message = '文件内容存在安全隐患，终止上传，请确认。';
                            console.error('[virus scan]');
                            console.error(error.stdout.toString());
                        }
                        callback(error);
                        return;
                    }
                }

                // fs.renameSync(tempFilePath, fileStorePath); // EXDEV: cross-device link not permitted
                const readStream=fs.createReadStream(tempFilePath);
                const writeStream=fs.createWriteStream(fileStorePath);
                readStream.pipe(writeStream);
                readStream.on('end',function(){
                    fs.unlinkSync(tempFilePath);
                    callback(null);
                });
                readStream.on('error',function(err){
                    fs.unlinkSync(tempFilePath);
                    callback(err);
                });
            }
            else if (OSS_STORE === storeName || S3_STORE === storeName) {
                // 将文件保存到OSS或S3

                const { S3Client } = require('./s3client')

                const stream = fs.createReadStream(tempFilePath);

                const folder = getS3FoldOption();
                const bucket = getS3BucketOption();

                const params = {
                    Bucket: bucket,
                    Key: folder + fileKey,
                    Body: stream
                };

                S3Client.upload(params, function (err, data) {
                    console.log(err, data);
                    // 删除临时文件
                    fs.unlinkSync(tempFilePath);

                    callback(err, data);
                });

            }
            else if (STEEDOSCLOUD_STORE === storeName) {
                // 将文件保存到STEEDOSCLOUD
                const { SteedosCloudClient } = require('./steedoscloudclient');

                const stream = fs.createReadStream(tempFilePath);

                const folder = getCloudFoldOption();
                const bucket = getCloudBucketOption();

                const params = {
                    Bucket: bucket,
                    Key: folder + fileKey,
                    Body: stream
                };

                const apikey = getCloudApikey();

                const req = SteedosCloudClient.putObject(params);
                req.on('build', function () {
                    req.httpRequest.headers['apikey'] = apikey;
                });
                req.send(function (err, data) {
                    console.log(err, data);
                    // 删除临时文件
                    fs.unlinkSync(tempFilePath);

                    callback(err, data);
                });


            }
            else {
                throw new Error(`Unsupported store name: ${storeName}`);
            }
        } catch (error) {
            console.error(error);
            callback(error)
        }
    }






}

/**
 * 读取文件流
 * @param {*} fsCollectionName 
 * @param {*} fileKey 
 * @returns stream
 */
async function createFileReadStream(fsCollectionName, fileKey) {
    const storeName = getStoreName();
    if (LOCAL_STORE === storeName) {
        const filePath = fileStoreFullPath(fsCollectionName, fileKey);
        const exists = fs.existsSync(filePath);
        if (!exists) {
            let error = new Error('No file found');
            error.statusCode = 404;
            throw error;
        }
        return fs.createReadStream(filePath);
    }
    else if (OSS_STORE === storeName || S3_STORE === storeName) {
        const { S3Client } = require('./s3client');
        const folder = getS3FoldOption();
        const bucket = getS3BucketOption();
        const params = {
            Bucket: bucket,
            Key: folder + fileKey
        };
        // 校验文件是否存在
        await S3Client.headObject(params).promise();

        return S3Client.getObject(params).createReadStream();
    }
    else if (STEEDOSCLOUD_STORE === storeName) {

        const { SteedosCloudClient } = require('./steedoscloudclient');

        const folder = getCloudFoldOption();
        const bucket = getCloudBucketOption();

        const params = {
            Bucket: bucket,
            Key: folder + fileKey,
        };

        const apikey = getCloudApikey();

        // 校验文件是否存在
        const metaDataReq = SteedosCloudClient.headObject(params);
        metaDataReq.on('build', function () {
            metaDataReq.httpRequest.headers['apikey'] = apikey;
        });
        await metaDataReq.promise();

        const req = SteedosCloudClient.getObject(params);
        req.on('build', function () {
            req.httpRequest.headers['apikey'] = apikey;
        });
        return req.createReadStream();
    }
    else {
        throw new Error(`Unsupported store name: ${storeName}`);
    }

}

module.exports = {
    File,
    createFileReadStream
};