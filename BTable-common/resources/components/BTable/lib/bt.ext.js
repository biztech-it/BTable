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


var bt = bt || {};
bt.ext = bt.ext || {};

bt.ext.olapCubesCache = {};

bt.ext.getOlapCube = function(catalog, cube, jndi) {
	var cubeStructure = null;
	
	$.ajax({
		type: "GET",
		url: bt.helpers.olap.getServiceUrl() + bt.helpers.olap.getCubeStructureUrl(),
		data: {
			catalog: bt.helpers.olap.getNormalizedCatalog(catalog),
			cube: cube,
			jndi: jndi
		},
		dataType: "json",
		success: function(json) {
			if(json && json.status == "true" && json.result) {
				if(json.result.dimensions && json.result.measures)
					cubeStructure = json.result;
			}
		},
		async: false
	});
	
	return cubeStructure;
};

bt.ext.openBTable = function(spec) {
	var def = {
		catalog: "",
		jndi: "",
		cube: "",
		dimensions: [],
		measures: [],
		pivotDimensions: [],
		filters: [],
		measuresOnColumns: true,
		nonEmptyRows: true,
		nonEmptyColumns: true,
		grandTotal: false,
		subTotals: false,
		pivotGrandTotal: false,
		pivotSubTotals: false,
		totalsPosition: "bottom",
		hideSpans: false,
		drillTarget: "SELF"
	};

	var prop = $.extend({}, def, spec);	

	var url = bt.helpers.general.getRenderServiceUrl() + "?";
	url += "btdef=" + encodeURIComponent(JSON.stringify(prop));
	
	if(typeof top.mantle_openTab !== "undefined")
		top.mantle_openTab("BTable", "BTable", url);
	else
		window.open(url, "_blank");
};

bt.ext.openBTableFile = function(path, title) {
    var url = bt.helpers.general.getRenderServiceUrl() + "?btfile=" + path;
	title = title === undefined ? "BTable" : title;
	
    if(typeof top.mantle_openTab !== "undefined")
        top.mantle_openTab(title, title, url);
    else
        window.open(url, "_blank");
};

/*
EXAMPLES:

1. Direct drill with fixed dimension(s):

	$("#myHtmlObject").click(function(e) {
		bt.ext.drillWithBTable({
			catalog: "mondrian:/SteelWheels",
			jndi: "SampleData",
			cube: "SteelWheelsSales",
			dimensions: [["[Product].[Line]",""]],
			measures: [["[Measures].[Sales]",""]],
			pivotDimensions: [],
			filters: [["[Time].[Years]","include:[2004]"]],
			grandTotal: true
		});
	});
	
	
2. Drill with popup to select the dimension from a limited set:

	$("#myHtmlObject").click(function(e) {
		bt.ext.drillWithBTable({
			catalog: "mondrian:/SteelWheels",
			jndi: "SampleData",
			cube: "SteelWheelsSales",
			dimensions: [], //ignored because overwritten by the user's selection
			measures: [["[Measures].[Quantity]",""]],
			pivotDimensions: [],
			filters: [["[Time].[Years]","include_un:[[Time].[2004]]"],["[Markets].[Territory]","include:[EMEA]"]],
			grandTotal: true
		},
		{
			x: e.pageX,
			y: e.pageY,
			title: "Select drill dimension...",
			options: [
				["Product Line","[Product].[Line]"],
				["Customer","[Customers].[Customer]"]                
			]
		});
	});

	
3. Drill with popup to select the dimension from the full set of dimensions in the cube:

	$("#myHtmlObject").click(function(e) {
		bt.ext.drillWithBTable({
			catalog: "mondrian:/SteelWheels",
			jndi: "SampleData",
			cube: "SteelWheelsSales",
			dimensions: [], //ignored because overwritten by the user's selection
			measures: [["[Measures].[Sales]",""],["[Measures].[Quantity]",""]],
			pivotDimensions: [],
			filters: [],
			grandTotal: true
		},
		{
			x: e.pageX,
			y: e.pageY,
			title: "Select drill dimension..."
		});
	});

*/
bt.ext.drillWithBTable = function(btable, prompt) {
	if(prompt) {
		var clickHandler = function() {
			btable.dimensions = [[$(this).data("qn"),""]];
			$("#BTableDrillPopup").hide();
			bt.ext.openBTable(btable);
		}
		
		var contentHtml = "";
		
		if(prompt.options && prompt.options.length > 0) {
			contentHtml += "<ul>";
			
			$.each(prompt.options, function(i, v) {
				contentHtml += "<li data-qn='" + v[1] + "'>" + v[0] + "</li>";
			});
			
			contentHtml += "</ul>";
		} else {
			if(bt.ext.olapCubesCache[btable.catalog + "::" + btable.cube] === undefined) {
				bt.ext.olapCubesCache[btable.catalog + "::" + btable.cube] = bt.ext.getOlapCube(btable.catalog, btable.cube, btable.jndi);
			}
			
			var cube = bt.ext.olapCubesCache[btable.catalog + "::" + btable.cube];
			
			var pivotHierarchies = $.map(btable.pivotDimensions, function(e){return (e[0].split("].[")[0] + "]").replace("]]", "]")});
			
			$.each(_.sortBy(cube.dimensions, function(e){return e.caption;}), function(i, dimension) {
				var dimensionName = dimension.caption;
				
				$.each(_.sortBy(dimension.hierarchies, function(e){return e.caption;}), function(j, hierarchy) {
					if(pivotHierarchies.indexOf(hierarchy.qualifiedName) < 0) {
						var hierarchyName = hierarchy.caption.indexOf(dimensionName + ".") === 0 ? hierarchy.caption.replace(dimensionName + ".", "") : hierarchy.caption;
						
						var showHierarchy = !(hierarchy.levels.length == 1 && hierarchy.levels[0].caption == dimensionName);
						if(showHierarchy)
							contentHtml += "<p class='hierarchy'>" + dimensionName + (dimensionName == hierarchyName ? "" : " :: " + hierarchyName) + "</p>";
						
						contentHtml += "<ul" + (showHierarchy ? " class='hierarchy'" : "") + ">";
						
						$.each(hierarchy.levels, function(k, level) {
							contentHtml += "<li data-qn='" + level.qualifiedName + "'>" + level.caption + "</li>";
						});
						
						contentHtml += "</ul>";
					}
				});
			});
		}
	
		var $popup = $("#BTableDrillPopup");
		
		if($popup.length) {
			$popup.find(".header .title").html(prompt.title ? prompt.title : "BTable Drill");
			$popup.find(".content").html(contentHtml);
			$("#BTableDrillPopup li").click(clickHandler);
			$popup.css("left", prompt.x).css("top", prompt.y).show();
		} else {			
			var popupHtml = 
			"<div id='BTableDrillPopup' class='btDrillPopup' style='position:absolute; left:" + prompt.x + "px; top:" + prompt.y + "px; z-index:100'>" +
			"  <div class='header'><div class='title'>" + (prompt.title ? prompt.title : "BTable Drill") + "</div><div class='closeButton'>X</div></div>" +
			"  <div class='content'>" + contentHtml + "</div>" +
			"</div>";
			$(popupHtml).appendTo("body");
			$("#BTableDrillPopup .closeButton").click(function(){ $("#BTableDrillPopup").hide(); });
			$("#BTableDrillPopup li").click(clickHandler);
		}
	} else {
		bt.ext.openBTable(btable);
	}
};
