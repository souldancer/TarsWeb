/**
 * Tencent is pleased to support the open source community by making Tars available.
 *
 * Copyright (C) 2016THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the BSD 3-Clause License (the "License"); you may not use this file except 
 * in compliance with the License. You may obtain a copy of the License at
 *
 * https://opensource.org/licenses/BSD-3-Clause
 *
 * Unless required by applicable law or agreed to in writing, software distributed 
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
 
const ServerDao = require('../../dao/ServerDao');
const AdapterDao = require('../../dao/AdapterDao');
const logger = require('../../logger');
const util = require('../../tools/util');
const ConfigService = require('../config/ConfigService');
const AdapterService = require('../adapter/AdapterService');
const AuthService = require('../auth/AuthService');
const ResourceService = require('../resource/ResourceService');
const resourceConf = require('../../../config/resourceConf');
const _  = require('lodash');
const ServerService = {};

ServerService.serverConfFields = ()=> {
    return {
        application: '',
        server_name: '',
        node_group: '',
        node_name: '',
        base_path: '',
        exe_path: '',
        template_name: '',
        bak_flag: 0,
        setting_state: 'inactive',
        present_state: 'inactive',
        process_id: 0,
        patch_version: '',
        patch_time: new Date('1970-01-01 00:00:00'),
        patch_user: '',
        tars_version: '',
        posttime: new Date('1970-01-01 00:00:00'),
        lastuser: '',
        server_type: 'tars_cpp',
        start_script_path: '',
        stop_script_path: '',
        monitor_script_path: '',
        enable_group: 'N',
        enable_set: 'N',
        set_name: '',
        set_area: '',
        set_group: '',
        ip_group_name: '',
        profile: '',
        config_center_port: 0,
        async_thread_num: 3,
        server_important_type: '0',
        remote_log_reserve_time: '65',
        remote_log_compress_time: '2',
        remote_log_type: 0
    };
};


//通过ID获取服务信息
ServerService.getServerConfById = async(id) => {
    return await ServerDao.getServerConfById(id);
};

//通过应用，服务，节点获取获取服务信息
ServerService.getServerConf = async(application, serverName, nodeName) => {
    return await ServerDao.getServerConf({
        application: application,
        serverName: serverName,
        nodeName: nodeName
    });
};

//通过模板名获取获取服务信息
ServerService.getServerConfByTemplate = async(templateName) => {
    return await ServerDao.getServerConfByTemplate(templateName);
};


//通过treeNodeId查询服务列表
ServerService.getServerConfList4Tree = async(params) => {
    return await ServerDao.getServerConf(params);
};

ServerService.getInactiveServerConfList = async(application, serverName, nodeName, curPage, pageSize) => {
    return await ServerDao.getInactiveServerConfList(
        application || '',
        serverName || '',
        nodeName || '',
        curPage || 0,
        pageSize || 0,
    );
};

ServerService.updateServerConf = async(params)=> {
    return await ServerDao.updateServerConf(params);
};


ServerService.addServerConf = async(params)=> {
    let transaction = await ServerDao.sequelize.transaction();
    try{
        let operator = params.operator;
        let developer = params.developer;
        delete(params.operator);
        delete(params.developer);

        let serverConf = ServerService.serverConfFields();

        serverConf = util.leftAssign(serverConf, params);
        serverConf.enable_set = params.enable_set ? 'Y' : 'N';
        if(serverConf.enable_set == 'N'){
            _.extend(serverConf, _.zipObject(['set_name', 'set_area', 'set_group'], [null, null, null]));
        }
        serverConf.posttime = new Date();

        await ServerDao.insertServerConf(serverConf, transaction);

        if (operator || developer) {
            await AuthService.addAuth(serverConf.application, serverConf.server_name, operator, developer);
        }

        let adapterConf = AdapterService.adpaterConfFields();
        let adapters = params.adapters;
        for (var i = 0; i < adapters.length; i++) {
            var servant = adapters[i];
            let newAdapterConf = Object.assign({}, adapterConf);
            newAdapterConf = util.leftAssign(newAdapterConf, servant);
            newAdapterConf.application = serverConf.application;
            newAdapterConf.server_name = serverConf.server_name;
            newAdapterConf.node_name = serverConf.node_name;
            newAdapterConf.endpoint = servant.port_type + ' -h ' + servant.bind_ip + ' -t 60000 -p ' + servant.port + ' -e ' + (servant.auth ? servant.auth : 0);
            newAdapterConf.servant = serverConf.application + '.' + serverConf.server_name + '.' + servant.obj_name;
            newAdapterConf.adapter_name = newAdapterConf.servant + 'Adapter';
            newAdapterConf.posttime = new Date();
            await AdapterDao.insertAdapterConf(newAdapterConf, transaction);
        }
        await transaction.commit();
        let rst = {server_conf: await ServerDao.getServerConfByName(serverConf.application, serverConf.server_name, serverConf.node_name), tars_node_rst: []};
        if(resourceConf.enableAutoInstall){
            rst.tars_node_rst = await ResourceService.installTarsNodes([params.node_name]);
        }
        return rst;
    }catch(e){
        await transaction.rollback();
        throw e;
    }
};

module.exports = ServerService;