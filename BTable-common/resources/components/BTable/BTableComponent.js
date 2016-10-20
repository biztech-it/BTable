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
 *
 * Dependencies: CDE, CDF, CDA
 *
 * This file is a modification of
 * https://github.com/webdetails/cdf/blob/13.03.25/bi-platform-v2-plugin/cdf/js/components/table.js
 */


/*
 * Function: fnLengthChange
 * Purpose:  Change the number of records on display
 * Returns:  array:
 * Inputs:   object:oSettings - DataTables settings object
 *           int:iDisplay - New display length
 */
//Ensure we load dataTables before this line. If not, just keep going
if($.fn.dataTableExt != undefined){
	$.fn.dataTableExt.oApi.fnLengthChange = function ( oSettings, iDisplay )
	{
		oSettings._iDisplayLength = iDisplay;
		oSettings.oApi._fnCalculateEnd( oSettings );

		// If we have space to show extra rows backing up from the end point - then do so
		if ( oSettings._iDisplayEnd == oSettings.aiDisplay.length )
		{
			oSettings._iDisplayStart = oSettings._iDisplayEnd - oSettings._iDisplayLength;
			if ( oSettings._iDisplayStart < 0 )
			{
				oSettings._iDisplayStart = 0;
			}
		}

		if ( oSettings._iDisplayLength == -1 )
		{
			oSettings._iDisplayStart = 0;
		}

		oSettings.oApi._fnDraw( oSettings );

		$('select', oSettings.oFeatures.l).val( iDisplay );
	};
	/* Example
	 * $(document).ready(function() {
	 *    var oTable = $('#example').dataTable();
	 *    oTable.fnLengthChange( 100 );
	 * } );
	 */
}

var BTableComponent = UnmanagedComponent.extend({

	ph: undefined,

	cda: {
		path: "",
		dataAccessId: "BTableQuery"
	},

	btParamName: undefined,

	bTable: undefined,

	headerRows: undefined,

	getBTable: function() {
		return this.bTable === undefined ? {} : this.bTable;
	},

	timer: undefined,

	init: function() {
		var componentName = this.name.replace("render_", "");

		this.btParamName = componentName + "MdxQuery";

		var fileError = false;
		/*
		 * We can have any combination of template and file.
		 * File has priority on template and components setting have priority on file
		 */
		var btdefTmpObj = null;
		var btdefFileObj = null;
		

		if(this.file) {
			var filePath = this.file;

			if(filePath.length > 7 && filePath.indexOf(".btable", filePath.length - 7) != -1) {

				$.ajax({
					type: "GET",
					url: bt.helpers.general.getReadFileServiceUrl(filePath),
					data: {},
					dataType: "json",
					success: function(json) {
						if(json) {
							btdefFileObj = json;
						}
					},
					async: false
				});

				if(btdefFileObj == null) {
					console.error("ERROR       [BTable: " + this.name + "] Initialization with file has failed!" +
					" Cause: NON-EXISTING FILE or WRONG PATH or ACCESS DENIED or INVALID CONTENT");
					fileError = true;
					this.error("BTableComponent can't be initialized with file");		
				} else if (!this.template && btdefFileObj.hasOwnProperty('template')) {
					this.template=btdefFileObj.template;
				}
			} else {
				console.error("ERROR       [BTable: " + this.name + "] Initialization with file has failed! File extension must be .btable");
				fileError = true;
				this.error("BTableComponent can't be initialized with file");
			}		
		}

		if(this.template) {
			var templatePath = this.template;
			$.ajax({
				type: "GET",
				url: bt.helpers.general.getReadFileServiceUrl(templatePath),
				data: {},
				dataType: "json",
				success: function(json) {
					if(json) {
						btdefTmpObj = json;
					}
				},
				async: false
			});

			if(btdefTmpObj == null) {			
				console.error("ERROR       [BTable: " + this.name + "] Initialization with template has failed!" +
				" Cause: NON-EXISTING FILE or WRONG PATH or ACCESS DENIED or INVALID CONTENT");
				fileError = true;
				this.error("BTableComponent can't be initialized with template");		
			}
		} else {
			var catalogS = ((this.catalog || !btdefFileObj.hasOwnProperty("catalog")) ? this.catalog : btdefFileObj.catalog).replace("mondrian:/","");
			var cubeS = ((this.cube || !btdefFileObj.hasOwnProperty("cube")) ? this.cube : btdefFileObj.cube);
			var templatePath = "/public/BTableCustom/Default_" + catalogS + "_" + cubeS + ".bttemplate";
			$.ajax({
				type: "GET",
				url: bt.helpers.general.getReadFileServiceUrl(templatePath),
				data: {},
				dataType: "json",
				success: function(json) {
					if(json) {
						btdefTmpObj = json;
					}
				},
				async: false
			});

			if(btdefTmpObj == null) {			
				btdefTmpObj = JSON.parse("{\"alarms\": {},\"alarmRules\": {}}");		
			}
		}

		if (btdefTmpObj != null || btdefFileObj != null) {
			var btdefObj = null;
			if (btdefTmpObj == null) {
				btdefObj = btdefFileObj;
			} else if (btdefFileObj == null) {
				btdefObj = btdefTmpObj;
			} else {
				btdefObj = $.extend( true, {}, btdefTmpObj, btdefFileObj );
			}

			var patches = {};
			if (this.file) 
				$.each(this.filters, function(i, v) {
					patches[v[0]] = v[1];
				});

			var applyPatches = function(jsonAxis) {
				var newAxis = [];
				$.each(jsonAxis, function(i, v) {
					var level = v[0];
					if(patches.hasOwnProperty(level)) {
						v[1] = patches[level];
						delete patches[level];
					}
					newAxis.push(v);
				});
				return newAxis;
			}		

			this.catalog = (this.catalog || !btdefObj.hasOwnProperty("catalog")) ? this.catalog : btdefObj.catalog;
			this.jndi = (this.jndi || !btdefObj.hasOwnProperty("jndi")) ? this.jndi : btdefObj.jndi;
			this.cube = (this.cube || !btdefObj.hasOwnProperty("cube")) ? this.cube : btdefObj.cube;

			this.dimensions = (btdefObj.hasOwnProperty("dimensions")) ? applyPatches(btdefObj.dimensions) : this.dimensions;
			this.measures = (btdefObj.hasOwnProperty("measures")) ? btdefObj.measures : this.measures;
			this.pivotDimensions = (btdefObj.hasOwnProperty("pivotDimensions")) ? applyPatches(btdefObj.pivotDimensions) : this.pivotDimensions;
			this.filters = (btdefObj.hasOwnProperty("filters")) ? applyPatches(btdefObj.filters) : this.filters;
			this.orderBy = (btdefObj.hasOwnProperty("orderBy")) ? applyPatches(btdefObj.orderBy) : this.orderBy;

			this.alarms = (btdefObj.hasOwnProperty("alarms")) ? btdefObj.alarms : {};
			this.alarmRules = (btdefObj.hasOwnProperty("alarmRules")) ? btdefObj.alarmRules : {};

			for(var level in patches) {
				var newFilter = [level, patches[level]];
				this.filters.push(newFilter);
			}

			if(this.tableSettingsFromFile && btdefFileObj != null) {
				this.measuresOnColumns = (btdefObj.hasOwnProperty('measuresOnColumns')) ? btdefObj.measuresOnColumns : true;
				this.nonEmptyRows = (btdefObj.hasOwnProperty('nonEmptyRows')) ? btdefObj.nonEmptyRows : true;
				this.nonEmptyColumns = (btdefObj.hasOwnProperty('nonEmptyColumns')) ? btdefObj.nonEmptyColumns : true;
				this.grandTotal = (btdefObj.hasOwnProperty('grandTotal')) ? btdefObj.grandTotal : false;
				this.subTotals = (btdefObj.hasOwnProperty('subTotals')) ? btdefObj.subTotals : false;
				this.pivotGrandTotal = (btdefObj.hasOwnProperty('pivotGrandTotal')) ? btdefObj.pivotGrandTotal : false;
				this.pivotSubTotals = (btdefObj.hasOwnProperty('pivotSubTotals')) ? btdefObj.pivotSubTotals : false;
				this.totalsPosition = (btdefObj.hasOwnProperty('totalsPosition')) ? btdefObj.totalsPosition : "bottom";
				this.hideSpans = (btdefObj.hasOwnProperty('hideSpans')) ? btdefObj.hideSpans : false;
				this.showAlarms = (btdefObj.hasOwnProperty('showAlarms')) ? btdefObj.showAlarms : true;
				this.showTable = (btdefObj.hasOwnProperty('showTable')) ? btdefObj.showTable : true;
				this.showZeros = (btdefObj.hasOwnProperty('showZeros')) ? btdefObj.showZeros : false;
				this.showToolbar = (btdefObj.hasOwnProperty('showToolbar')) ? btdefObj.showToolbar : false;
			}
		}

		if(!this.catalog || !this.jndi || !this.cube) {
			console.error("ERROR       [BTable: " + this.name + "] Initialization has failed! Catalog, JNDI and cube are required");
			if(!fileError) this.error("BTableComponent requires Catalog, Jndi and Cube");
		}

//		this.cda.path = bt.helpers.cda.getFilePath(this.catalog, this.jndi);

		this.bTable = new bt.components.BTable({
			componentName: this.name,
			componentHtmlObject: this.htmlObject,
			catalog: this.catalog,
			jndi: this.jndi,
			cube: this.cube,
			dimensions: this.dimensions,
			measures: this.measures,
			filters: this.filters,
			pivotDimensions: this.pivotDimensions,
			measuresOnColumns: this.measuresOnColumns,
			orderBy: this.orderBy,
			nonEmptyRows: this.nonEmptyRows,
			nonEmptyColumns: this.nonEmptyColumns,
			grandTotal: this.grandTotal,
			subTotals: this.subTotals,
			pivotGrandTotal: this.pivotGrandTotal,
			pivotSubTotals: this.pivotSubTotals,
			//totalsPosition: this.totalsPosition.toLowerCase(),
			hideSpans: this.hideSpans,
			showFilters: this.showFilters,
			exportStyle: this.exportStyle ? this.exportStyle : {},
			fixedHeader: this.fixedHeader === undefined ? true : this.fixedHeader,
			drillTarget: this.drillTarget !== undefined ? this.drillTarget : ((this.drillInPUC === undefined || this.drillInPUC) && typeof top.mantle_openTab !== "undefined" ? "NEW_TAB" : "NEW_WINDOW"),
			renderDashboard: this.renderDashboard === undefined ? false : this.renderDashboard,
			showAlarms: this.showAlarms === undefined ? true : this.showAlarms,
			alarms: this.alarms ? this.alarms : {},
			alarmRules: this.alarmRules ? this.alarmRules : {},
			template: this.template	? this.template	: "",
			updateTemplate: true,
			showTable: this.showTable === undefined ? true : this.showTable,
			showZeros: this.showZeros === undefined ? false : this.showZeros,
			showToolbar: this.showToolbar === undefined ? false : this.showToolbar
		});

		if(!this.bTable.olapCube.getStructure()) {
			console.error("ERROR       [BTable: " + this.name + "] Unable to get the cube structure! Cube name may be incorrect");
			this.error("");
		}

		$("#" + this.htmlObject).addClass("bTableComponent");
	},

	update: function() {
		if(this.timer == undefined)
			this.timer = getTimer({component: {type: "BTable", name: this.name}});
		this.timer.start("Start component updating");

		if(!this.preExec()){
			return;
		}

		if(!this.htmlObject) {
			return this.error("BTableComponent requires an htmlObject");
		}	

		if(!this.isInitialized) {
			this.init();
			this.isInitialized = true;
		}

		this.cda.path = bt.helpers.cda.getFilePath(this.catalog, this.jndi);
		

		try{
			this.block();
			this.setup();

			var mdxQuery = this.bTable.query.getMdx();
			console.log(mdxQuery);
			this.timer.check("Query string returned");

			Dashboards.setParameter(this.btParamName, mdxQuery);
			this.parameters = [["mdxQuery" , this.btParamName]];

			if(this.bTable.properties.showTable) {
				if(this.chartDefinition.paginateServerside) {
					this.paginatingUpdate();
				} else {
					/* The non-paging query handler only needs to concern itself
					 * with handling postFetch and calling the draw function
					 */
					var success = _.bind(function(data){
						this.rawData = data;
						this.processTableComponentResponse(data)
					},this);
					var handler = this.getSuccessHandler(success);

					this.queryState.setAjaxOptions({async:true});
					this.queryState.fetchData(this.parameters, handler);
				}
			} else { //Just Query
				$("#" + this.htmlObject).prepend("<div id='" + this.bTable.properties.filtersPanelHtmlObject +
						"' class='filtersPanel'" + (this.bTable.properties.showFilters ? "" : " style='display:none'") + "></div>");
				this.bTable.printFilters("");

				this.postExec();
				this.unblock();
				// Hide Table
				$("#" + this.htmlObject + "Table_wrapper").hide();
			}
		} catch (e) {
			/*
			 * Something went wrong and we won't have handlers firing in the future
			 * that will trigger unblock, meaning we need to trigger unblock manually.
			 */
			this.unblock();
		}
	},

	paginatingUpdate: function() {
		var cd = this.chartDefinition;
		this.extraOptions = this.extraOptions || [];
		this.extraOptions.push(["bServerSide",true]);
		this.extraOptions.push(["bProcessing",true]);
		this.queryState.setPageSize(parseInt(cd.displayLength || 10));
		this.queryState.setCallback(_.bind(function(values) {
			changedValues = undefined;
			if((typeof(this.postFetch)=='function')){
				changedValues = this.postFetch(values);
			}
			if (changedValues != undefined) {
				values = changedValues;
			}
			this.processTableComponentResponse(values);
		},this));
		this.queryState.setParameters(this.parameters);
		this.queryState.setAjaxOptions({async:true});
		this.processTableComponentResponse();
	},

	/* Initial setup: clearing out the htmlObject and building the query object */
	setup: function() {
		var cd = this.chartDefinition;

		cd.path = this.cda.path;
		cd.dataAccessId = this.cda.dataAccessId;

		cd.colSearchable = [];
		cd.filter = false;
		cd.info = false;
		cd.lengthChange = false;
		cd.paginate = false;
		cd.paginateServerside = false;
		cd.paginationType = "two_button";
		cd.sort = false;    
		cd.tableStyle = "classic";

		var myself = this;

		var mouseButton = isMobile.any() ? "left" : "right";

		$("#"+this.htmlObject).contextMenu({
			selector: 'thead th',
			className: 'menu-with-title',
			trigger: mouseButton,
			build: function($trigger, e) {
				// this callback is executed every time the menu is to be shown
				// its results are destroyed every time the menu is hidden
				// e is the original contextmenu event, containing e.pageX and e.pageY (amongst other data)
				var target = $(e.target).closest("th").data("btref");
				return myself.bTable.buildHeaderContextMenu(target);
			}
		}).contextMenu({
			selector: 'tbody td.dataTables_empty',
			className: 'menu-with-title',
			trigger: mouseButton,
			build: function($trigger, e) {
				return myself.bTable.buildNoDataContextMenu();
			}
		}).contextMenu({
			selector: 'tbody td',
			className: 'menu-with-title',
			trigger: mouseButton,
			build: function($trigger, e) {
				var state = {},
				target = $(e.target),
				results = myself.rawData;
				if(!(target.parents('tbody').length)) {
					return;
				} else if (target.get(0).tagName != 'TD') {
					target = target.closest('td');
				}
				var position = myself.dataTable.fnGetPosition(target.get(0));
				state.rawData = myself.rawData;
				state.tableData = myself.dataTable.fnGetData();
				state.colIdx = position[2];
				state.rowIdx = position[0];

				if(cd.colFormats) {
					state.colFormat = cd.colFormats[state.colIdx];
				}
				state.target = target;

				return myself.bTable.buildBodyContextMenu(state);
			}
		});

		if (cd == undefined){
			Dashboards.log("Fatal - No chart definition passed","error");
			return;
		}
		cd["tableId"] = this.htmlObject + "Table";

		// Clear previous table
		this.ph = $("#"+this.htmlObject).empty();
		// remove drawCallback from the parameters, or
		// it'll be called before we have an actual table...
		var croppedCd = $.extend({},cd);
		croppedCd.drawCallback = undefined;
		this.queryState = new Query(croppedCd);
		this.query = this.queryState; // for analogy with ccc component's name
		// make sure to clean sort options
		var sortBy = this.chartDefinition.sortBy || [],
		sortOptions = [];
		for (var i = 0; i < sortBy.length; i++) {
			var col = sortBy[i][0];
			var dir = sortBy[i][1];
			sortOptions.push( col + (dir == "asc" ? "A" : "D"));
		}
		this.queryState.setSortBy(sortOptions);
	},

	pagingCallback: function(url, params,callback,dataTable) {
		function p( sKey ) {
			for ( var i=0, iLen=params.length ; i<iLen ; i++ ) {
				if ( params[i].name == sKey ) {
					return params[i].value;
				}
			}
			return null;
		}
		var sortingCols = p("iSortingCols"),sort = [];
		if (sortingCols > 0) {
			for (var i = 0; i < sortingCols; i++) {
				var col = p("iSortCol_" + i);
				var dir = p("sSortDir_" + i);
				sort.push( col + (dir == "asc" ? "A" : "D"));
			}
		}
		var query = this.queryState,
		myself = this;
		query.setSortBy(sort.join(","));
		query.setPageSize(parseInt(p("iDisplayLength")));
		query.setPageStartingAt(p("iDisplayStart"));
		query.fetchData(function(d) {
			if (myself.postFetch){
				var mod = myself.postFetch(d,dataTable);
				if (typeof mod !== "undefined") {
					d = mod;
				}
			}
			var response = {
					iTotalRecords: d.queryInfo.totalRows,
					iTotalDisplayRecords: d.queryInfo.totalRows
			};
			response.aaData = d.resultset;
			response.sEcho = p("sEcho");
			myself.rawData = d;
			callback(response);
		});
	},

	/* 
	 * Callback for when the table is finished drawing. Called every time there
	 * is a redraw event (so not only updates, but also pagination and sorting).
	 * We handle addIns and such things in here.
	 */
	fnDrawCallback: function(dataTableSettings) {
		var dataTable = dataTableSettings.oInstance,
		cd = this.chartDefinition,
		myself = this;

		this.timer.check("Table drawn without alarms and spans");

		var measuresLevelColIdx = $.inArray("[Measures].[MeasuresLevel]", cd.colHeaders);
		var formatStrings = myself.bTable.olapCube.getFormatStrings();
		var cellFormats = [];
		if(measuresLevelColIdx < 0) {
			$.each(myself.rawData.metadata, function(i, v) {
				if(v.colType == "numeric" && v.colName.indexOf("[Measures].[") >= 0) {
					if (!v.colIsCalculated) {
						var start_pos = v.colName.indexOf("[Measures].");
						if(start_pos >= 0) {
							var end_pos = v.colName.indexOf("]", start_pos+10);
							var measureName = v.colName.substring(start_pos,end_pos+1);
							cellFormats.push(formatStrings[measureName]);
						}
					} else {
						cellFormats.push(v.colFormat);
					}
				} else {
					cellFormats.push("");
				}
			});
		}

		// Faster Measures Formatting 
//		var oTable = $("#" + myself.htmlObject + " table").dataTable();
//		var oRows = $("#" + myself.htmlObject + " tbody tr");
//		var hasMoC = this.bTable.query.hasMeasuresOnColumns();	    	
//		if (hasMoC) {
//			for (var index = 0; index < myself.rawData.metadata.length; index++) {
//				var column = myself.rawData.metadata[index].colName;
//				var isMeasure = (column.indexOf("[Measures]") >= 0);
//				var coltype = myself.rawData.metadata[index].colType;
//				format = cellFormats[index];
//				if(coltype == "numeric" && isMeasure) {
//					oRows.each(function() {
//						var aData = oTable.fnGetData(this);
//						var value = aData[index] == "" ? 0 : parseFloat(aData[index]);
//						if (format && (typeof value != "undefined" && value !== null)) {
//							$('td:eq(' + index + ')',this).text(getLocalizedFormattedValue(format,value));
//						}
//					});
//				}
//			}
//		} else {
//			var index = $.inArray("[Measures].[MeasuresLevel]", $.map(myself.rawData.metadata, function(e){ return e.colName; }));
//			var measuresAttr = myself.bTable.query.getMeasuresAttr();
//			oRows.each(function(i, tr) {
//				var aData = oTable.fnGetData(this);
//				var splittedValues = aData[index].split("|");
//				var measureName = splittedValues[0];
//				var measureIdx = splittedValues[1];
//				format = formatStrings[myself.bTable.olapCube.getQualifiedNameByCaption(measureName, "L")];
//				if (typeof measuresAttr[measureIdx]["format"] != "undefined" && measuresAttr[measureIdx]["format"] != "") 
//					format = measuresAttr[measureIdx]["format"];
//				for (var col = index+1; col < aData.length; col++) {
//					var value = aData[col] == "" ? 0 : parseFloat(aData[col]);
//					if (typeof value != "undefined" && value !== null && format) {
//						$('td:eq(' + col + ')',this).text(getLocalizedFormattedValue(format,value));
//					}
//				}
//			});
//		}	

		/* Old urlTemplate code. This needs to be here for backward compatibility */
		if(cd.urlTemplate != undefined){
			var td =$("#" + myself.htmlObject + " td:nth-child(1)"); 
			td.addClass('cdfClickable');
			td.bind("click", function(e){
				var regex = new RegExp("{"+cd.parameterName+"}","g");
				var f = cd.urlTemplate.replace(regex,$(this).text());
				eval(f);
			});
		}

		var thead = $("<thead></thead>");
		for(i = 0; i < this.headerRows.length; i++) {
			var lastRow = (i == this.headerRows.length - 1) ? true : false;
			var headerRow = this.headerRows[i];
			var tr = $("<tr></tr>");
			$.each(headerRow, function(j, col) {
				if(lastRow) col.index = j;
				var html = "";
				html += "<th data-btref='" + JSON.stringify(col) + "'";
				html += (col.colspan == undefined || col.colspan == 1) ? "" : " colspan='" + col.colspan + "'";
				html += (col.rowspan == undefined || col.rowspan == 1) ? "" : " rowspan='" + col.rowspan + "'";
				html += ">" + col.caption + "</th>";
				var th = $(html);
				tr.append(th);
			});
			thead.append(tr);
		}

		this.ph.find("thead").empty().prepend(thead.html());

		var oTable = $("#" + myself.htmlObject + " table").dataTable();
		$("#" + myself.htmlObject + " tbody tr").each(function() {
			var totalCells = $(this).find("td:contains('BT_TOTAL')");
			if(totalCells.length > 0) {
				var aData = oTable.fnGetData(this);
				var isGrandTotalRow = $(this).find("td:eq(0):contains('BT_TOTAL')").length == 1;
				var tds = $(this).find("td");
				tds.addClass("subtotal");
				if(isGrandTotalRow) {tds.removeClass("subtotal"); tds.addClass("grandtotal");}
				totalCells.each(function(i) {
					if(i == 0) {
						$(this).text($.i18n.prop('table_total') + " " + (oTable.fnGetPosition( this )[1] > 0 ? aData[oTable.fnGetPosition( this )[1] - 1] : ""));
					}
					else
						$(this).empty();
				});
			}
		});
		
/*
		oTable.dragtable({
			persistState: function(table) { 
			    table.el.find('th').each(function(i) { 
			        if(this.id != '') {table.sortOrder[this.id]=i;} 
			     });
			    alert("persist");
		    } 
		  }); 
*/
		
		/*
		 * Table PostProcessing: 
		 * 		- Format Numbers
		 * 		- Set Alarms
		 */
		if(myself.bTable.properties.showAlarms) {

			if(myself.bTable.properties.updateTemplate) {
				var btdefTmpObj = null;
				if(myself.bTable.properties.template) {
					var templatePath = this.bTable.properties.template;
					$.ajax({
						type: "GET",
						url: bt.helpers.general.getReadFileServiceUrl(templatePath),
						data: {},
						dataType: "json",
						success: function(json) {
							if(json) {
								btdefTmpObj = json;
							}
						},
						async: false
					});

					if(btdefTmpObj == null) {			
						console.error("ERROR       [BTable: " + this.name + "] Initialization with template has failed!" +
						" Cause: NON-EXISTING FILE or WRONG PATH or ACCESS DENIED or INVALID CONTENT");
						fileError = true;
						this.error("BTableComponent can't be initialized with template");		
					}
				} else {
					var catalogS = myself.bTable.properties.catalog.replace("mondrian:/","");
					var cubeS = myself.bTable.query.getCube();
					var templatePath = "/public/BTableCustom/Default_" + catalogS + "_" + cubeS + ".bttemplate";
					$.ajax({
						type: "GET",
						url: bt.helpers.general.getReadFileServiceUrl(templatePath),
						data: {},
						dataType: "json",
						success: function(json) {
							if(json) {
								btdefTmpObj = json;
							}
						},
						async: false
					});

					if(btdefTmpObj == null) {			
						btdefTmpObj = JSON.parse("{\"alarms\": {},\"alarmRules\": {}}");		
					}
				}
				myself.alarms = (btdefTmpObj.hasOwnProperty("alarms")) ? btdefTmpObj.alarms : {};
				myself.alarmRules = (btdefTmpObj.hasOwnProperty("alarmRules")) ? btdefTmpObj.alarmRules : {};
				myself.bTable.properties.updateTemplate=false;
			}

			$("#" + myself.htmlObject).append("<style id='alarmsStylesheet'></style>");
			$("#alarmsStylesheet").text(this.alarmRules.toString().replace(/,/g , " "));

		var oTable = $("#" + myself.htmlObject + " table").dataTable();
		var oRows = $("#" + myself.htmlObject + " tbody tr");
		var hasMoC = this.bTable.query.hasMeasuresOnColumns();	    	
		if (hasMoC) {
			for (var index = 0; index < myself.rawData.metadata.length; index++) {
				var column = myself.rawData.metadata[index].colName;
				var start_pos = column.indexOf("[Measures]");
				var coltype = myself.rawData.metadata[index].colType;
				if(start_pos >= 0 && coltype == "numeric") {
					var end_pos = column.indexOf("]", start_pos+10);
					var level = column.substring(start_pos,end_pos+1);
					var alarmsRules = myself.bTable.properties.alarms[level];
					if (typeof alarmsRules !== "undefined") {
						var limits = [];
						var conditions = [];
						var classes = [];
							for (var i = 0; i < alarmsRules.length; i++) {
								limits[i] = alarmsRules[i]["limit"];
								conditions[i] = alarmsRules[i]["condition"];
								classes[i] = alarmsRules[i]["alarmClass"];
							}
						oRows.each(function(i, v) {
							var aData = oTable.fnGetData(this);
							var value = aData[index] == "" ? 0 : parseFloat(aData[index]);
							for (var i = 0; i < alarmsRules.length; i++) {
								var expr = value + " " + conditions[i] + " " + limits[i];
								if (eval(expr)) {
									$('td:eq(' + index + ')',this).addClass(classes[i]);
									break;
								}
							}
						});
					}
				}
			}
		} else {
			var index = $.inArray("[Measures].[MeasuresLevel]", $.map(myself.rawData.metadata, function(e){ return e.colName; }));
			var measuresAttr = myself.bTable.query.getMeasuresAttr();
			oRows.each(function() {
				var aData = oTable.fnGetData(this);
				var splittedValues = oTable.fnGetData(this)[index].split("|");
				var measureName = splittedValues[0];
				var measureIdx = splittedValues[1];
				level = myself.bTable.olapCube.getQualifiedNameByCaption(measureName, "L");
				var alarmsRules = myself.bTable.properties.alarms[level];
				if (typeof alarmsRules !== "undefined") {
					var limits = [];
					var conditions = [];
					var classes = [];
					for (var i = 0; i < alarmsRules.length; i++) {
						limits[i] = alarmsRules[i]["limit"];
						conditions[i] = alarmsRules[i]["condition"];
						classes[i] = alarmsRules[i]["alarmClass"];
					}
					for (var col = index+1; col < aData.length; col++) {
						var value = aData[col] == "" ? 0 : aData[col];
						for (var i = 0; i < alarmsRules.length; i++) {
							var expr = value + " " + conditions[i] + " " + limits[i];
							if (eval(expr)) {
								$('td:eq(' + col + ')',this).addClass(classes[i]);
								break;
							}
						}
					}
				}
			});
		}
	}
		var zippedRows = myself.bTable.getBodyRowspans();
		$.each(zippedRows, function(i, arr) {
			var position = 0;
			var indexes = $.map(arr, function(e) {
				position += e.rowspan;
				return position;
			});
			indexes.splice(0, 0, 0);
			$("#" + myself.htmlObject + " tbody tr td:nth-child(" + (i + 1) + ")").each(function(k) {
				if($.inArray(k, indexes) < 0)
					$(this).empty();
			});
		});
		
		var index = $.inArray("[Measures].[MeasuresLevel]", $.map(myself.rawData.metadata, function(e){ return e.colName; }));
		if (index >= 0) {
			$("#" + myself.htmlObject + " tbody tr td:nth-child(" + (index + 1) + ")").each(function() {
				var cellValue = $(this).html();
				if (cellValue.indexOf("|") > 0)
					$(this).html(cellValue.substring(0,cellValue.indexOf("|")));
			});
		}
		
		// Hide Zero Columns and Rows 
//		if(!myself.bTable.properties.showZeros) {
//			for (var i = 0; i < unwantedColumns.length; i++) {
//				//$("#" + myself.htmlObject + " tbody tr td:nth-child(" + (unwantedColumns[i] + 1) + "),th:nth-child(" + (unwantedColumns[i] + 1) + ")").hide();
//				$("#" + myself.htmlObject + " tbody tr td:nth-child(" + (unwantedColumns[i] + 1) + ")").hide();
//				$("#" + myself.htmlObject + " thead tr:last th:nth-child(" + (unwantedColumns[i] + 1) + ")").hide();
//			}
//			for (var i = 0; i < unwantedRows.length; i++) 
//					//$("#" + myself.htmlObject + " tbody tr").eq(unwantedRows[i]).hide();
//					$("#" + myself.htmlObject + " tbody tr").eq(unwantedRows[i]).remove();
//			$("#" + myself.htmlObject + " tbody").each(function() {        
//			    $(this).find("tr:visible:even").addClass("even").removeClass("odd");
//			    $(this).find("tr:visible:odd").addClass("odd").removeClass("even");
//			});
//		}

		
		
		this.timer.check("Table completely drawn");

		/* Handle post-draw callback the user might have provided */
		if(typeof cd.drawCallback == 'function'){
			cd.drawCallback.apply(myself,arguments);
		}

	},

	/* 
	 * Handler for when the table finishes initialising. This only happens once,
	 * when the table *initialises* ,as opposed to every time the table is drawn,
	 * so it provides us with a good place to add the postExec callback.
	 */
	fnInitComplete: function() {
		// Toolbar
		$("#" + this.htmlObject).prepend("<div id='" + this.bTable.properties.toolbarPanelHtmlObject +
				"' class='toolbarPanel'" + (this.bTable.properties.showToolbar ? "" : " style='display:none'") + "></div>");
		//if (this.rawData.resultset[0])
		this.bTable.createToolbar();
		// Filters
		$("#" + this.htmlObject).prepend("<div id='" + this.bTable.properties.filtersPanelHtmlObject +
				"' class='filtersPanel'" + (this.bTable.properties.showFilters ? "" : " style='display:none'") + "></div>");
		if (this.rawData.resultset[0])
			this.bTable.printFilters("(" + this.rawData.resultset.length + " x " + this.rawData.resultset[0].length + ")");
		//this.bTable.printFilters("(" + $("#" + this.htmlObject + " tbody").children('tr').length + " x " + $("#" + this.htmlObject + " tbody").children("tr:first").find("td:not([style*='display: none'])").length + ")");

		if(this.bTable.properties.fixedHeader)
			$("#" + this.htmlObject + " .tableComponent").fixHeader();


		this.postExec();
		this.unblock();
		/* Hide Table */
		if(!this.bTable.properties.showTable) {
			var sel = $("#" + this.htmlObject + "Table_wrapper");
			//var sel = $("#" + this.htmlObject);
			sel.hide();
		}
	},

	/* 
	 * Resolve and call addIns for the given td in the context of the given 
	 * dataTable. Returns true if there was an addIn and it was successfully
	 * called, or false otherwise.
	 */
	handleAddIns: function(dataTable, td, $td, rowIdx, colIdx) {
		var cd = this.chartDefinition,
		 colType = cd.colTypes[colIdx],
		 state = {},
		 target = $td,
		 results = this.rawData,
		 addIn = this.getAddIn("colType",colType);
		if (!addIn) {
			return false;
		}
		try {
			if(!(target.parents('tbody').length)) {
				return;
			} else if (target.get(0).tagName != 'TD') {
				target = target.closest('td');
			}
			state.rawData = results;
			state.tableData = dataTable.fnGetData();
			state.colIdx = colIdx;
			state.rowIdx = rowIdx;
			state.series = results.resultset[state.rowIdx][0];
			state.category = results.metadata[state.colIdx].colName;
			state.value =  results.resultset[state.rowIdx][state.colIdx];
			if(cd.colFormats) {
				state.colFormat = cd.colFormats[state.colIdx];
			}
			state.target = target;
			addIn.call(td,state,this.getAddInOptions("colType",addIn.getName()));
			return true;
		} catch (e) {
			this.dashboard.error(e);
			return false;
		}
	},

	processTableComponentResponse : function(json) {
		var myself = this,
		cd = this.chartDefinition,
		extraOptions = {};

		this.timer.check("Query result returned");
		
		var noResult = json.metadata.length == 0;
		
		var measuresAttr = myself.bTable.query.getMeasuresAttr();
		var definition = myself.bTable.query.getDefinition();
		$.each(myself.rawData.metadata, function (i, v) {
			var colName = v.colName;
	    	var startPos = colName.indexOf("[Measures].[Measure");
	    	if(startPos >= 0 && colName != "[Measures].[MeasuresLevel]") {
	    		var endPos = colName.indexOf("]", startPos + 19);
	    		var measureIdx = colName.substring(startPos + 19,endPos);
	    		v.colName = colName.replace(colName.substring(startPos,endPos + 1),definition.measures[measureIdx][0]);
	    		v.colMeasureIdx = measureIdx;
		    	v.colIsCalculated = (definition.measures[measureIdx][1] != "");
		    	v.colFormat = measuresAttr[measureIdx]["format"];
	    	}
		});

		// Loads Formats
		var measuresLevelColIdx = $.inArray("[Measures].[MeasuresLevel]", json.metadata.map(function(i){return i.colName}));
		var formatStrings = myself.bTable.olapCube.getFormatStrings();
		var cellFormats = [];
		if(measuresLevelColIdx < 0) {
			$.each(myself.rawData.metadata, function(i, v) {
				if(v.colType == "Numeric" && v.colName.indexOf("[Measures].[") >= 0) {
					if (!v.colIsCalculated) {
						var start_pos = v.colName.indexOf("[Measures].");
						if(start_pos >= 0) {
							var end_pos = v.colName.indexOf("]", start_pos+10);
							var measureName = v.colName.substring(start_pos,end_pos+1);
							cellFormats.push(formatStrings[measureName]);
						}
					} else {
						cellFormats.push(measuresAttr[measureIdx]["format"]);
					}
				} else {
					cellFormats.push("");
				}
			});
		}

		// Set Zeros Rows And Columns and Format numbers 
		if (!noResult) {
			var zerosColumns = [];
			for (var col = 0; col < myself.rawData.resultset[0].length; col++) {
		    	var isMeasure = myself.rawData.metadata[col].colName.indexOf("[Measures].[") >= 0;
				zerosColumns[col]=((measuresLevelColIdx >=0 && col <= measuresLevelColIdx) || (measuresLevelColIdx < 0 && !isMeasure)) ? false : true;
			}
			var measuresColumns = zerosColumns.slice();
			for (var row = myself.rawData.resultset.length - 1; row >= 0; row--) {
				var rowIsZeros = true;
				var format = "";
				if (measuresLevelColIdx >= 0) {
					var colName = myself.rawData.resultset[row][measuresLevelColIdx];
			    	var startPos = colName.indexOf("Measure");
			    	var measureIdx = colName.substring(startPos + 7);
			    	var qualifiedMeasureName = myself.bTable.properties.measures[measureIdx][0];
			    	startPos = qualifiedMeasureName.indexOf("[Measures].[");
			    	var endPos = qualifiedMeasureName.indexOf("]", startPos + 12);
			    	var measureName = qualifiedMeasureName.substring(startPos + 12,endPos);
					format = formatStrings[myself.bTable.olapCube.getQualifiedNameByCaption(measureName, "L")];
				}
				for (var col = measuresLevelColIdx + 1; col < myself.rawData.resultset[row].length; col++) {
					var value = myself.rawData.resultset[row][col];
					if (typeof value != "undefined" && value !== null && !isNaN(value) && value != 0) {
						if (measuresColumns[col]) {
							rowIsZeros = false;
						}
						if (zerosColumns[col]) {
							zerosColumns[col]=false;
						}
						if (measuresLevelColIdx < 0) 
							format = cellFormats[col];
						 myself.rawData.resultset[row][col] = getLocalizedFormattedValue(format,value)
						
					}
				}
				if (rowIsZeros && !myself.bTable.properties.showZeros)
					myself.rawData.resultset.splice(row, 1);
			}

			if(!myself.bTable.properties.showZeros) {
				for (var row = 0; row < myself.rawData.resultset.length; row++) {
					myself.rawData.resultset[row] = $.grep(myself.rawData.resultset[row], function(e, i) {
						//return !myself.rawData.metadata[i].colDelete;
						return !zerosColumns[i];
					});
				}
				myself.rawData.queryInfo.totalRows=myself.rawData.resultset.length;
				myself.rawData.metadata = $.grep(myself.rawData.metadata, function(e, i) {
					//return !e.colDelete;
					return !zerosColumns[i];
				});
			}
		}
		
		this.timer.check("Numbers formatted and zeros deleted");
		
		json = myself.bTable.normalizeCdaJson(json);

		this.ph.trigger('cdfTableComponentProcessResponse');    


		if(!noResult)
			myself.bTable.setHeaders(json.metadata.map(function(i){return {colName: i.colName, colMeasureIdx: i.colMeasureIdx}}));

		myself.headerRows = noResult ? [] : myself.bTable.getHeaders();

		// Set defaults for headers / types
		cd.colHeaders = noResult ? [] : json.metadata.map(function(i){return i.colName});
		cd.colTypes = noResult ? [] : json.metadata.map(function(i){return i.colType.toLowerCase()});
		cd.colFormats = noResult ? [] : json.metadata.map(function(i){return i.colType.toLowerCase() == "numeric" ? /*"%.2f"*/"%d" : "%s"});
		cd.colMeasureIdx = noResult ? [] : json.metadata.map(function(i){return i.colMeasureIdx});

		var dtData0 = TableComponent.getDataTableOptions(cd);

		if(noResult)
			dtData0.aoColumns = [{sClass:"column0 string", sTitle:"", sType:"string"}];

		// Build a default config from the standard options
		$.each(this.extraOptions ? this.extraOptions : {}, function(i,e){
			extraOptions[e[0]] = e[1];
		});
		var dtData = $.extend(cd.dataTableOptions,dtData0,extraOptions);

		/* Configure the table event handlers */
		if(!noResult)
			dtData.fnDrawCallback = _.bind(this.fnDrawCallback,this);
		dtData.fnInitComplete = _.bind(this.fnInitComplete,this);
		/* fnServerData is required for server-side pagination */
		if (dtData.bServerSide) {
			var myself = this;
			dtData.fnServerData = function(u,p,c) {
				myself.pagingCallback(u,p,c,this);
			};
		}

		/* We need to make sure we're getting data from the right place,
		 * depending on whether we're using CDA
		 */
		if (json) {
			dtData.aaData = json.resultset;
			/*
			for ( i=1 ; i<dtData.aaData ; i++ )
			{
				dtData.aaData.slice( i , 1);
			}
			*/
		}

		this.ph.html("<table id='" + this.htmlObject + "Table' class='tableComponent' width='100%'></table>");
		this.dataTable = $("#"+this.htmlObject+'Table').dataTable(dtData);
		
		if(noResult) 
			$("#"+this.htmlObject+'Table td.dataTables_empty').html($.i18n.prop("table_no_data"));

		// We'll create an Array to keep track of the open expandable rows.
		this.dataTable.anOpen = [];


		myself.ph.find ('table').bind('click',function(e) {
			if (typeof cd.clickAction === 'function' || myself.expandOnClick) { 
				var state = {},
				target = $(e.target),
				results = myself.rawData; 
				if(!(target.parents('tbody').length)) {
					return;
				} else if (target.get(0).tagName != 'TD') {
					target = target.closest('td');
				}
				var position = myself.dataTable.fnGetPosition(target.get(0));
				state.rawData = myself.rawData;
				state.tableData = myself.dataTable.fnGetData();
				state.colIdx = position[2];
				state.rowIdx = position[0];
				state.series = results.resultset[state.rowIdx][0];

				state.category = results.metadata[state.colIdx].colName;
				state.value =  results.resultset[state.rowIdx][state.colIdx];
				state.colFormat = cd.colFormats[state.colIdx];

				/*
        if(cd.colFormats) {
          state.colFormat = cd.colFormats[state.colIdx];
        }
				 */

				state.target = target;

				if ( myself.expandOnClick ) {
					myself.handleExpandOnClick(state);
				}
				if ( cd.clickAction  ){
					cd.clickAction.call(myself,state);
				}
			}      
		});
		
		myself.ph.trigger('cdfTableComponentFinishRendering');


	},

	handleExpandOnClick: function(event) {
		var myself = this,
		detailContainerObj = myself.expandContainerObject,
		activeclass = "expandingClass";

		if(typeof activeclass === 'undefined'){
			activeclass = "activeRow";
		}

		var obj = event.target.closest("tr"),
		a = event.target.closest("a");

		if (a.hasClass ('info')) {
			return;
		} else {
			var row = obj.get(0),
			value = event.series,
			htmlContent = $("#" + detailContainerObj).html(),
			anOpen = myself.dataTable.anOpen,
			i = $.inArray( row, anOpen );

			if( obj.hasClass(activeclass) ){
				obj.removeClass(activeclass);
				myself.dataTable.fnClose( row );
				anOpen.splice(i,1);

			} else {
				// Closes all open expandable rows .
				for ( var j=0; j < anOpen.length; j++ ) {
					$(anOpen[j]).removeClass(activeclass);
					myself.dataTable.fnClose( anOpen[j] );
					anOpen.splice(j ,1);
				}
				obj.addClass(activeclass);

				anOpen.push( row );
				// Since the switch to async, we need to open it first
				myself.dataTable.fnOpen( row, htmlContent, activeclass );

				//Read parameters and fire changes
				var results = myself.queryState.lastResults();
				$(myself.expandParameters).each(function f(i, elt) {
					Dashboards.fireChange(elt[1], results.resultset[event.rowIdx][parseInt(elt[0],10)]);              
				});

			};
		};
		$("td.expandingClass").click(
				function(event){
					//Does nothing but it prevents problems on expandingClass clicks!
					event.stopPropagation();
					return;
				}
		);
	}

},

{
	getDataTableOptions : function(options) {
		var dtData = {};

		if(options.tableStyle == "themeroller"){
			dtData.bJQueryUI = true;
		}
		dtData.bInfo = options.info;
		dtData.iDisplayLength = options.displayLength;
		dtData.bLengthChange = options.lengthChange;
		dtData.bPaginate = options.paginate;
		dtData.bSort = options.sort;
		dtData.bFilter = options.filter;
		dtData.sPaginationType = options.paginationType;
		dtData.sDom = options.sDom;
		dtData.aaSorting = options.sortBy;

		if (typeof options.oLanguage == "string"){
			dtData.oLanguage = eval("(" + options.oLanguage + ")");//TODO: er...
		}
		else {
			dtData.oLanguage = options.oLanguage;
		}

		if(options.colHeaders != undefined){
			dtData.aoColumns = new Array(options.colHeaders.length);
			for(var i = 0; i< options.colHeaders.length; i++){
				dtData.aoColumns[i]={}
				dtData.aoColumns[i].sClass="column"+i;
			};
			$.each(options.colHeaders,function(i,val){
				dtData.aoColumns[i].sTitle=val;
				if(val == "") dtData.aoColumns[i].bVisible=false;
			});  // colHeaders
			if(options.colTypes!=undefined){
				$.each(options.colTypes,function(i,val){
					var col = dtData.aoColumns[i];
					// Specific case: hidden cols
					if(val == "hidden") col.bVisible=false;
					col.sClass+=" "+val;
					col.sType=val;

				})
			};  // colTypes
			if(options.colFormats!=undefined){
				// Changes are made directly to the json

			};  // colFormats

			var bAutoWidth = true;
			if(options.colWidths!=undefined){
				$.each(options.colWidths,function(i,val){
					if (val!=null){
						dtData.aoColumns[i].sWidth=val;
						bAutoWidth = false;
					}
				})
			}; //colWidths
			dtData.bAutoWidth = bAutoWidth;

			if(options.colSortable!=undefined){
				$.each(options.colSortable,function(i,val){
					if (val!=null && ( !val || val == "false" ) ){
						dtData.aoColumns[i].bSortable=false
					}
				})
			}; //colSortable
			if(options.colSearchable!=undefined){
				$.each(options.colSearchable,function(i,val){
					if (val!=null && ( !val || val == "false" ) ){
						dtData.aoColumns[i].bSearchable=false
					}
				})
			}; //colSearchable

		}

		return dtData;
	}
});
