/*
 * Copyright 2013-2014 Biz Tech (http://www.biztech.it). All rights reserved.
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
 */
 

// PENTAHO 4
 
var bt = bt || {};
bt.helpers = bt.helpers || {};

(function(obj) {

	obj.general = {
		getLangDirPath: function() {
			return Dashboards.getWebAppPath() + "/content/BTable/resources/components/BTable/lang/";
		},
		
		getImgDirPath: function() {
			return Dashboards.getWebAppPath() + "/content/BTable/resources/components/BTable/img/";
		},

		getRenderServiceUrl: function() {
			return Dashboards.getWebAppPath() + "/content/BTable/render";
		},
		
		getExploreRepositoryServiceUrl: function() {
			return Dashboards.getWebAppPath() + "/content/pentaho-cdf-dd/ExploreFolder?fileExtensions=.btable&access=create";
		},		
		
		getSaveFileServiceUrl: function() {
			return Dashboards.getWebAppPath() + "/content/BTable/save";
		},
		
		getReadFileServiceUrl: function(path) {
			return Dashboards.getWebAppPath() + "/content/BTable/read?path=" + path;
		}		
	};
	
	obj.util = {
		getServiceResultEvaluation: function(result) {
			return eval("(" + result + ")");
		}
	};
	
	obj.cda = {
		getFilePath: function(catalog, jndi) {
			return "/system/BTable/resources/datasources/" + jndi + "_" + catalog.replace(/\//g, "_").replace(".xml", ".cda");
		},

		getServiceUrl: function() {
			return Dashboards.getWebAppPath() + "/content/cda/doQuery";
		}		
	};

	obj.olap = {
		getServiceUrl: function() {
			return Dashboards.getWebAppPath() + "/content/BTable/olapUtils";
		},

		getCubesUrl: function() {
			return "?operation=GetCubes";
		},

		getCubeStructureUrl: function() {
			return "?operation=GetCubeStructure";
		},
		
		getNormalizedCatalog: function(catalog) {
			return "solution:" + catalog;
		}
	};

})(bt.helpers);


jQuery.i18n.properties({
	name: 'messages',
	path: bt.helpers.general.getLangDirPath(),
	mode: 'map',
	//language: 'it_IT'
	callback: function() {
		//console.log($.i18n.map);		
	}
});
