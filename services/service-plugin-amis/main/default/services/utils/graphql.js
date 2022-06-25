const objectql = require('@steedos/objectql');
const _ = require('underscore');
function getFieldsTemplate(fields, expand){
    if(expand != false){
        expand = true;
    }
    let fieldsName = ['_id'];
    let displayFields = [];
    //TODO 此处需要考虑相关对象查询
    _.each(fields, function(field){
        if(field.name.indexOf('.') < 0){
            if(expand && (field.type == 'lookup' || field.type == 'master_detail') && field.reference_to){
                const NAME_FIELD_KEY = objectql.getObject(field.reference_to).NAME_FIELD_KEY;
                fieldsName.push(`${field.name}:${field.name}__expand{_id,${NAME_FIELD_KEY}}`)
            }else{
                fieldsName.push( field.alias ? `${field.alias}:${field.name}` : field.name)
            }

            if(field.type === 'date' || field.type == 'datetime' || field.type == 'boolean'){
                fieldsName.push(`${field.name}`)
            }

            if(field.type === 'date' || field.type == 'datetime' || field.type == 'boolean' || field.type == 'select'){
                displayFields.push(`${field.name}`)
            }
        }
    })

    displayFields = _.uniq(displayFields);
    fieldsName = _.uniq(fieldsName);

    if(displayFields.length > 0){
        return `${fieldsName.join(',')},_display{${displayFields.join(',')}}`;
    }
    return `${fieldsName.join(' ')}`
}

function getFindOneQuery(object, recordId, fields, options){
    let queryOptions = "";
    if(recordId){
        queryOptions = `(filters:["_id", "=", "${recordId}"])`;
    }
    let alias = "data";
    if(options){
        if(options.alias){
            alias = options.alias;
        }

        if(options.filters){
            queryOptions = `(filters:${options.filters})`;
        }
        if(options.queryOptions){
            queryOptions = `(${options.queryOptions})`;
        }
    }
    return {
        query: `{${alias}:${object.name}${queryOptions}{${getFieldsTemplate(fields)}}}`
    }
}

function getSaveQuery(object, recordId, fields, options){
    return {
        objectName: "${objectName}",
        $: "$$",
        recordId: "${recordId}",
        modalName: "${modalName}"
    }
}

function getSaveDataTpl(fields){
    let imgFieldsKeys = [];
    let imgFields = {};
    fields.forEach((item)=>{
        if(item.type === 'image'){
            imgFieldsKeys.push(item.name);
            imgFields[item.name] = {
                name: item.name,
                multiple: item.multiple
            };
        }
    })
    return `
        const formData = api.data.$;
        const objectName = api.data.objectName;
        const fieldsName = Object.keys(formData);
        delete formData.created;
        delete formData.created_by;
        delete formData.modified;
        delete formData.modified_by;

        let imgFieldsKeys = ${JSON.stringify(imgFieldsKeys)};
        let imgFields = ${JSON.stringify(imgFields)};
        imgFieldsKeys.forEach((item)=>{
            let imgFieldValue = formData[item];
            if(imgFieldValue && imgFieldValue.length){
                // 因为表单初始化接口的接收适配器中为image字段值添加了url前缀（为了字段编辑时正常显示图片），所以保存时移除（为了字段值保存时正常保存id,而不是url）。
                if(imgFields[item].multiple){
                    if(imgFieldValue instanceof Array){
                        formData[item] = imgFieldValue.map((value)=>{ 
                            let itemValue = value?.split('/');
                            return itemValue[itemValue.length - 1];
                        });
                    }
                }else{
                    let imgValue = imgFieldValue.split('/');
                    formData[item] = imgValue[imgValue.length - 1];
                }
            }
        })

        let query = \`mutation{record: \${objectName}__insert(doc: {__saveData}){_id}}\`;
        if(formData.recordId){
            query = \`mutation{record: \${objectName}__update(id: "\${formData.recordId}", doc: {__saveData}){_id}}\`;
        };
        delete formData._id;
        let __saveData = JSON.stringify(JSON.stringify(formData));
    `
}

function getSaveRequestAdaptor(fields){
    return `
        ${getSaveDataTpl(fields)}
        api.data = {query: query.replace('{__saveData}', __saveData)};
        return api;
    `
}

function getFindQuery(object, recordId, fields, options){
    let limit = options.limit || 10;
    let queryOptions = `(top: ${limit})`;
    if(recordId){
        queryOptions = `(filters:["_id", "=", "${recordId}"], top: ${limit})`;
    }
    let alias = "data";
    if(options){
        if(options.alias){
            alias = options.alias;
        }

        if(options.filters){
            queryOptions = `(filters:${options.filters})`;
        }
        if(options.queryOptions){
            queryOptions = `(${options.queryOptions})`;
        }
    }
    return {
        orderBy: "${orderBy}",
        orderDir: "${orderDir}",
        pageNo: "${page}",
        pageSize: "${perPage}",
        query: `{${alias}:${object.name}${queryOptions}{${getFieldsTemplate(fields, options.expand)}},count:${object.name}__count(filters:{__filters})}`
    }
}
exports.getFindQuery = getFindQuery;
exports.getFindOneQuery = getFindOneQuery;
exports.getSaveQuery = getSaveQuery;
exports.getSaveRequestAdaptor = getSaveRequestAdaptor;


exports.getApi = function(isMobile){
    if(isMobile){
        //TODO 返回 绝对路径
    }else{
        // return __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + "/graphql"
        return `\${context.rootUrl}/graphql`
    }
}