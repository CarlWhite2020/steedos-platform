/*
 * @Author: 孙浩林 sunhaolin@steedos.com
 * @Date: 2024-05-14 15:59:27
 * @LastEditors: 孙浩林 sunhaolin@steedos.com
 * @LastEditTime: 2024-05-18 13:30:31
 * @FilePath: /steedos-platform-2.3/services/service-cachers-manager/src/metadata-cachers/object_functions.ts
 * @Description: 
 */

import { MetadataCacherBase } from './base'

export class ObjectFunctionsCacher extends MetadataCacherBase{
    constructor(){
        super('object_functions', false, { isEnabled: true });
    }

    onAdded(doc){
        this.set(this._getIdKey(doc), doc);
    }

    onChanged(newDoc, oldDoc) {
        this.set(this._getIdKey(newDoc), newDoc);
    }

    onRemoved(doc) {
        this.delete(this._getIdKey(doc));
    }

    _getIdKey(doc){
        return `${doc.objectApiName}__${doc.name}` // 用两个下划线防止key重复
    }
}