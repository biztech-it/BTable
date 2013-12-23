/*
 * Copyright 2013 Biz Tech (http://www.biztech.it). All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at
 * http://mozilla.org/MPL/2.0/.
 *
 * Covered Software is provided under this License on an “as is” basis,
 * without warranty of any kind, either expressed, implied, or statutory,
 * including, without limitation, warranties that the Covered Software is
 * free of defects, merchantable, fit for a particular purpose or non-infringing.
 * The entire risk as to the quality and performance of the Covered Software is with You.
 * Should any Covered Software prove defective in any respect, You (not any Contributor)
 * assume the cost of any necessary servicing, repair, or correction.
 * This disclaimer of warranty constitutes an essential part of this License.
 * No use of any Covered Software is authorized under this License except under this disclaimer.
 *
 * Initial contributors: Luca Pazzaglia, Massimo Bonometto
 *
 * This file includes a modification of
 * https://github.com/webdetails/cde/blob/13.03.25/server/plugin/resource/resources/custom/components/OlapSelector/lib/OlapUtils.js
 */


var bt = bt || {};
bt.utils = bt.utils || {};

bt.utils.OlapUtils = function(spec) {
    
    var defaults = {
        url: bt.helpers.olap.getServiceUrl(),
        extraParams: {}
    };

    var myself = {};
    
    myself.options = $.extend({}, defaults, spec);
    
    var catalog = myself.options.catalog;
    var cube = myself.options.cube;

    var cubeStructureCache = {};
    
    var olapOperations = {
        GET_OLAP_CUBES: bt.helpers.olap.getCubesUrl(),
        GET_CUBE_STRUCTURE: bt.helpers.olap.getCubeStructureUrl()
    };
    
    myself.getOlapUtilsUrl = function() {
        return myself.options.url  
    };
    
    myself.getCubeStructure = function(_args) {
        var catalog = myself.getSelectedCatalogName(_args);
        
        var cube = myself.getSelectedCubeName(_args);
        var cacheKey = catalog + "::" + cube;
        
        if(!catalog || !cube) {
            return null;
        }
        
        if(cubeStructureCache[cacheKey]) {
            return cubeStructureCache[cacheKey];
        }
                
        var params = {
            operation: olapOperations.GET_CUBE_STRUCTURE,
            catalog: catalog,
            cube: cube
        };
        
        // make a sync call
        var result = myself.callOlapUtilsSync(params);
        
        cubeStructureCache[cacheKey] = result;
        
        return result;
    };

    myself.getSelectedCatalogName = function(_args) {
        var catalog = $.extend({}, myself.options, _args).catalog;		
        return bt.helpers.olap.getNormalizedCatalog(catalog);
    };
    
    myself.getSelectedCubeName = function(_args) {
        return $.extend({},myself.options,_args).cube;
    };
    
    myself.callOlapUtilsSync = function(params) {
        return myself.callOlapUtils(params, undefined, undefined, true);
    };
    
    myself.callOlapUtils = function(params, callback, errorCallback, sync) {
    	var myself = this;
        
        var ret;
        
        $.ajax({
			type: "GET",
            url: myself.getOlapUtilsUrl() + params.operation,
            data: $.extend({}, myself.options.extraParams, params),
            dataType: "json",
            success: function(json){
                if(json && json.status == "true" && json.result) {
                    
                    // sync only sets the value
                    if(sync){
                        ret = json.result
                    }
                    else{
                        callback(json.result);
                    }
                }
                else {
                    if(typeof(errorCallback) != 'function' ) errorCallback = alert;
                    return errorCallback(json);
                }
            },
            async: !sync
        });

        return ret;    
    };

    myself.getCube = function(_args) {
        return myself.getCubeStructure(_args);
    };

    myself.getLevelMembers = function(_args, callback) {
	/*	previous implementation (doesn't work in Pentaho 5):
	
        var defaults = {
            operation: 'GetLevelMembers'
        } 

        var params = $.extend({},defaults,_args);
        
        params.catalog = myself.getSelectedCatalogName(_args);
        params.cube = myself.getSelectedCubeName(_args);
        
        params.member = params.level;

        var result = myself.callOlapUtilsSync(params);

        return result;
	*/

		var apiUrl = bt.helpers.cda.getServiceUrl();
		
		var level = _args.level;
		var cube = _args.cube;
		var mdxQuery = "with member [Measures].[Unique Name] as '" + level + ".CurrentMember.UniqueName' select distinct(" + level + ".Members) on Rows, {[Measures].[Unique Name]} ON Columns from [" + cube + "]"; 
		
		var params = {
			path: bt.helpers.cda.getFilePath(myself.options.catalog, myself.options.jndi),
			dataAccessId: "BTableQueryCompact",
			parammdxQuery: mdxQuery
		};
		
        var result;
        
        $.ajax({
			type: "GET",
            url: apiUrl,
            data: params,
            dataType: "json",
            success: function(json){
                if(json && json.resultset) {
                    result = json.resultset
                }
            },
            async: false
        });	
				
		var members = [];
		
		$.each(result, function(i, v) {
			members.push({name: v[0] , qualifiedName: v[1]});
		});
		
		return {members: members};
		
    };    
    
    return myself;
    
}


function getURLQuery() {
	var query = {};
	var conditions = window.location.search.slice(1).split('&');
	$.each(conditions, function(i, c) {
		var condition = c.split('=');
		query[condition[0]] = decodeURIComponent(condition[1]);
	});
	return query;
}


function getTimer(spec) {
    var defaults = {
        log: true,
        component: {
            type: "BTable",
            name: ""
        },
    };

    var myself = {};

    myself.options = $.extend({}, defaults, spec);

    var startDate = null;
    var prevDate = null;
    var lastDate = null;
    var lastElapsedTime = 0;
    var totalElapsedTime = 0;

    myself.start = function(message) {
        startDate = new Date();
        prevDate = startDate;
        lastDate = startDate;
        lastElapsedTime = 0;
        totalElapsedTime = 0;
        if(myself.options.log)
            myself.log("START", message);
    };

    myself.check = function(message) {
        if(startDate != null) {
            lastDate = new Date();
            lastElapsedTime = lastDate.getTime() - prevDate.getTime();
            totalElapsedTime = lastDate.getTime() - startDate.getTime();
            prevDate = lastDate;
            if(myself.options.log)
                myself.log("CHECK", message);
        } else {
            console.log("You have missed to start timer for component '" + myself.options.component.name + "' !");
        }
    };

    myself.log = function(action, message) {
        var text = "TIMER." + action + " [" + myself.options.component.type + ": " + myself.options.component.name + "] >> " + message + " @ " + myself.formatDate(lastDate);
        if (action == "CHECK")
            text += " (" + myself.formatTime(lastElapsedTime) + " since last check, " + myself.formatTime(totalElapsedTime) + " since start)";
        console.log(text);
    };

    myself.formatDate = function(date) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var milliseconds = date.getMilliseconds();

        return year + "/" + (month < 10 ? "0" : "") + month + "/" + (day < 10 ? "0" : "") + day +
               " " + (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds +
               "." + (milliseconds < 10 ? "00" : (milliseconds < 100 ? "0" : "")) + milliseconds;
    }

    myself.formatTime = function(milliseconds) {
        var seconds = milliseconds / 1000;
        return seconds + " s";
    }

    return myself;
}
