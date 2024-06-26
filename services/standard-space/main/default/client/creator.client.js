/*
 * @Author: baozhoutao@steedos.com
 * @Date: 2023-02-27 19:09:19
 * @LastEditors: baozhoutao@steedos.com
 * @LastEditTime: 2023-04-27 15:51:14
 * @Description: 
 */
if(window.Meteor){
    if(!window.Creator){
        window.Creator = {};
    }
    
    Creator.getObject = (objectName)=>{
        if(!objectName){
            if(window.Session){
                objectName = Session.get("object_name")
            }
            if(!objectName){
                throw new Error('miss objectName')
            }
        }
        return getUISchemaSync(objectName);
    }
    
    Creator.getPermissions = (object_name, spaceId, userId)=>{
        return Creator.getObject(object_name).permissions;
    }

    Creator.getRecordPermissions = (objectName,record, userId, spaceId)=>{
        const record_id = record._id;
        var result = Steedos.authRequest(`/service/api/@${objectName}/recordPermissions/${record_id}`, {type: 'get', async: false} );
        return result || {};
    }
    
    Creator.getCollection = (objectName)=>{
        if(!objectName){
            if(window.Session){
                objectName = Session.get("object_name")
            }
            if(!objectName){
                throw new Error('miss objectName')
            }
        }
        return db[objectName]
    }
    window.refreshGrid = ()=>{
        return FlowRouter.reload();
    };

    FlowRouter.reload = function(){window.location.reload()}

    if(!window.signOut){
        window.signOut = window.Steedos.logout;
    }

    if(Meteor.isCordova && !window.DragEvent){
        window.DragEvent = {}
    }
}
	