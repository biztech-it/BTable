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

bt.Query = function(properties, olapCube) {

    var defaults = {
    	cube: "",
        dimensions: [],
        measures: [],
        pivotDimensions: [],
        filters: [],
        measuresOnColumns: true,
        nonEmpty: {
        	columns: true,
        	rows: true
        },
        summary: {
        	grandTotal: true,
        	subTotals: true,
        	pivotGrandTotal: true,
        	pivotSubTotals: true,
        	position: "bottom"
        },
        orders: []
    };

    var myself = {};

    var settings = $.extend({}, defaults, properties);

    var history = [];

    var definition = {
    	cube: settings.cube,
    	dimensions: settings.dimensions,
    	measures: settings.measures,
    	pivotDimensions: settings.pivotDimensions,
    	filters: settings.filters,
        orders: settings.orders
    }

    myself.saveInHistory = function() {
    	var def = $.extend(true, {}, definition);
    	history.push(def);
    }

    myself.saveInHistory();

    myself.reset = function() {
    	definition = $.extend(true, {}, history[0]);

        initializeFiltersMap(definition.dimensions);
        initializeFiltersMap(definition.pivotDimensions);
        initializeFiltersMap(definition.filters);

        filtersMap.synchronizedByParameters = true;

        initializeOrdersMap();
    }

    myself.validate = function(olapCube) {
        // At least one dimension and one measure!
        // No measures in filter!
    	// The same hierarchy can't be in two different axis!
    	// Levels of a same hierarchy have to be adjacent and in order of increasing depth!
        // Only one "MEASURES" placeholder in pivot dimensions!
    }


    myself.getPlainFilter = function(levelQualifiedName) {
    	var result = "";

    	var lQn = levelQualifiedName;
    	var hQn = (lQn.split("].[")[0] + "]").replace("]]", "]");

    	var boundToDashboard = filtersMap.synchronizedByParameters;

    	var isCalculatedMember = lQn.indexOf("].[") < 0;

    	var level = isCalculatedMember ? filtersMap.hierarchies[hQn].calculatedMembers : filtersMap.hierarchies[hQn].levels[lQn];

    	if(level.filtered) {
			var filterMode = level.filterMode + (level.uniqueNames ? "_un" : "");
	    	var members = null;

			if(boundToDashboard && level.synchronizedByParameters) {
		    	var filterExpression = level.initialFilterExpression;
		    	var param = filterExpression.replace(filterMode + ":", "");
				var members = Dashboards.getParameterValue(param);
    		} else {
    			members = level.members;
    		}

			result = filterMode + ":[" + ( $.isArray(members) ? members.join("],[") : members ) + "]";
    	}

    	return result;
    }

    var getMdxFilter = function(levelQualifiedName, hierarchyQualifiedName) {
    	var mdx = "";

    	var lQn = levelQualifiedName;
    	var hQn = !hierarchyQualifiedName ? (lQn.split("].[")[0] + "]").replace("]]", "]") : hierarchyQualifiedName;

    	var boundToDashboard = filtersMap.synchronizedByParameters;

    	var isCalculatedMember = lQn.indexOf("].[") < 0;

    	//var level = filtersMap.hierarchies[hQn].levels[lQn];

    	var level = isCalculatedMember ? filtersMap.hierarchies[hQn].calculatedMembers : filtersMap.hierarchies[hQn].levels[lQn];

    	if(level.filtered) {
			var filterMode = level.filterMode;
	    	var include = filterMode == "include";
	    	var exclude = filterMode == "exclude";
	    	var between = filterMode == "between";

	    	var uniqueNames = level.uniqueNames;
	    	if(uniqueNames) filterMode += "_un";

	    	var members = null;

			if(boundToDashboard && level.synchronizedByParameters) {
		    	var filterExpression = level.initialFilterExpression;
		    	var param = filterExpression.replace(filterMode + ":", "");
				members = Dashboards.getParameterValue(param);
    		} else {
    			members = level.members;
    		}

			if($.isArray(members)) {
				members = $.map(members, function(e) {
					return e.replace(/[']/g, "''");
				});
			} else {
				members = members.replace(/[']/g, "''");
			}
			
			var separator = between ? " :" : ",";

			if(uniqueNames) {
				mdx = $.isArray(members) ? members.join(separator + " ") : members;
				mdx = "{" + mdx + "}";
			} else {
				if(between) {
					//mdx = "{Head(Filter({" + lQn + ".Members}, (" + lQn + ".CurrentMember.Name = \"" + members[0] + "\")), 1).Item(0) : Tail(Filter({" + lQn + ".Members}, (" + lQn + ".CurrentMember.Name = \"" + members[1] + "\")), 1).Item(0)}";
					mdx = "Filter({" + lQn + ".Members}, (" + lQn + ".CurrentMember.Name >= \"" + members[0] + "\" AND " + lQn + ".CurrentMember.Name <= \"" + members[1] + "\"))";
				} else {
					mdx = $.isArray(members) ? members.join("\" OR " + lQn + ".CurrentMember.Name = \"") : members;
					mdx = "Filter({" + lQn + ".Members}, (" + lQn + ".CurrentMember.Name = \"" + mdx + "\"))";
				}
			}

			if(exclude)
				mdx = "Except(" + lQn + ".Members, " + mdx + ")";

			if(members.length == 0 || mdx.indexOf(".[]") > -1 || mdx.indexOf(".[All]") > -1 || mdx.indexOf("\"All\"") > -1)
				mdx = "";
    	}

    	return mdx;
    }


    myself.getMdx = function() {
    	// Levels of a same hierarchy have to be adjacent and in order of increasing depth!
    	
    	var dimensionHierarchies = [];
    	var pivotHierarchies = [];
    	var filterHierarchies = [];

    	var pivotHierarchyBeforeMeasures = "";

    	var addLevelToHierarchy = function(levelObj, hierarchyObjs) {
    		var hierarchyIndex = $.map(hierarchyObjs, function(hierarchy, index) {
    		      if(hierarchy.name == levelObj.hierarchy)
    		    	  return index;
    		});
    		if(hierarchyIndex.length > 0) {
    			hierarchyObjs[hierarchyIndex[0]].levels.push(levelObj);
    		} else {
    			hierarchyObjs.push({
    				name: levelObj.hierarchy,
    				levels: new Array(levelObj)
    			});
    		}
    	}

		$.each(definition.dimensions, function(i, v) {
			var qualifiedName = v[0];
			var qnParts = qualifiedName.substring(1, qualifiedName.length -1).split("].[");
			var hierarchy = qnParts[0];
			var level = qnParts.length < 2 ? "" : qnParts[1];

			addLevelToHierarchy({
				hierarchy: hierarchy,
				name: level,
				qualifiedName: qualifiedName
			}, dimensionHierarchies);
		});

		var previousHierarchyName = "";

		$.each(definition.pivotDimensions, function(i, v) {
			var qualifiedName = v[0];
			if(qualifiedName == "MEASURES") {
				pivotHierarchyBeforeMeasures = i == 0 ? "NONE" : previousHierarchyName;
			} else {
				var qnParts = qualifiedName.substring(1, qualifiedName.length -1).split("].[");
				var hierarchy = qnParts[0];
				var level = qnParts.length < 2 ? "" : qnParts[1];

				addLevelToHierarchy({
					hierarchy: hierarchy,
					name: level,
					qualifiedName: qualifiedName
				}, pivotHierarchies);

				previousHierarchyName = hierarchy;
			}
		});

		var invalidHierarchies = $.map(dimensionHierarchies, function(e) {
			return "[" + e.name + "]";
		}).concat($.map(pivotHierarchies, function(e) {
			return "[" + e.name + "]";
		}));

		//console.log(invalidHierarchies);

		for(var key in filtersMap.hierarchies) {
			if($.inArray(key, invalidHierarchies) < 0) {
				var hierarchy = filtersMap.hierarchies[key];
				var levels = hierarchy.levels;
				$.each(hierarchy.order, function(i, v) {
					if(levels[v].filtered) {
						var qn = v;
						var qnParts = qn.substring(1, qn.length -1).split("].[");
						var h = qnParts[0];
						var l = qnParts.length < 2 ? "" : qnParts[1];

						addLevelToHierarchy({
							hierarchy: h,
							name: l,
							qualifiedName: qn
						}, filterHierarchies);
					}
				});
			}
		}

		//console.log(filterHierarchies);

        var getMdxCrossjoins = function(sets) {
        	var mdx = "";
        	if(sets.length > 0) {
                var _sets = sets.slice();
            	if(_sets.length == 1) {
            	    mdx = _sets[0];
            	} else {
            	    mdx = "Crossjoin(" + _sets.shift() + ", " + getMdxCrossjoins(_sets) + ")";
            	}        		
        	}
        	return mdx;
        }

    	var mdx = [];
    	mdx["members"] = [];
    	mdx["sets"] = [];
    	mdx["columns"] = "";
    	mdx["rows"] = "";
    	mdx["cube"] = definition.cube;
    	mdx["slicer"] = "";

    	var mdxSets = [];
		var mdxTotalMembers = [];
		var mdxAxis = "";

		$.each(dimensionHierarchies, function(i, hierarchy) {
			var lastLevel = hierarchy.levels[hierarchy.levels.length-1];

			if(settings.summary.grandTotal || settings.summary.subTotals) {
				if(lastLevel.name == "") {
					mdxTotalMembers.push("[" + lastLevel.hierarchy + "_" + lastLevel.name + "_Set]");
				} else {
					mdx["members"].push("member [" + hierarchy.name + "].[BT_TOTAL] as 'Aggregate([" + lastLevel.hierarchy + "_" + lastLevel.name + "_Set])'");
					mdxTotalMembers.push("[" + hierarchy.name + "].[BT_TOTAL]");
				}
			}

			var previousLevelName = [];
			var previousLevelAllMembers = [];

			$.each(hierarchy.levels, function(j, level) {
				var mdxFilteredSet = getMdxFilter(level.qualifiedName, "[" + hierarchy.name + "]");
				var mdxNamedSet = mdxFilteredSet == "" ? "{" + level.qualifiedName + ".Members}" : mdxFilteredSet;

				if(j > 0) {
					var mdxConditions = [];
					$.each(previousLevelName, function(k, previousLevelName) {
						if(!previousLevelAllMembers[k])
							mdxConditions.push("(Exists(Ancestor([" + level.hierarchy + "].CurrentMember, [" + level.hierarchy + "].[" + previousLevelName + "]), [" + level.hierarchy + "_" + previousLevelName + "_Set]).Count > 0))");
					});

					if(mdxConditions.length > 0) {
						mdxNamedSet = "Filter(" + mdxNamedSet + ", ";
						mdxNamedSet += "(" + mdxConditions.join(" AND ") + ")";
						mdxNamedSet += ")";
					}
				}

				if(ordersMap.levels.hasOwnProperty(level.qualifiedName)) {
					var order = ordersMap.levels[level.qualifiedName];
					var by = order.by;
					if(by == "name") {
						by = level.qualifiedName + ".CurrentMember.Name";
					}
					var direction = order.dir;
					mdxNamedSet = "Order(" + mdxNamedSet + ", " + by + ", " + direction + ")";
				}

				mdx["sets"].push("set [" + level.hierarchy + "_" + level.name + "_Set] as '" + mdxNamedSet + "'");

				previousLevelName.push(level.name);
				previousLevelAllMembers.push(mdxFilteredSet == "" ? true : false);
			});

			var mdxHierarchySet = "[" + lastLevel.hierarchy + "_" + lastLevel.name + "_Set]";
			if(hierarchy.levels.length > 1)
				mdxHierarchySet = "Descendants(" + mdxHierarchySet + ", " + lastLevel.qualifiedName + ", SELF)";

			if(settings.summary.subTotals && i > 0 && i == dimensionHierarchies.length - 1 && !ordersMap.axes.hasOwnProperty("dimensions")) {
				if(settings.summary.position == "top")
					mdxHierarchySet = "Union([" + hierarchy.name + "].[BT_TOTAL], " + mdxHierarchySet + ")";
				else if(settings.summary.position == "bottom")
					mdxHierarchySet = "Union(" + mdxHierarchySet + ", [" + hierarchy.name + "].[BT_TOTAL])";
			}

			mdxSets.push(mdxHierarchySet);
		});


		if(settings.summary.subTotals && !ordersMap.axes.hasOwnProperty("dimensions") && mdxSets.length > 2) {
            var btTotals = mdxTotalMembers.slice();
            mdxAxis = "{?}";
            var i = 0;
            for(i; i < mdxSets.length - 2; i++) {
                btTotals.shift();
                mdxAxis = mdxAxis.replace("{?}", "Crossjoin(" + mdxSets[i] + ", Union({?}, " + getMdxCrossjoins(btTotals) + "))");
            }
            mdxAxis = mdxAxis.replace("{?}", "Crossjoin(" + mdxSets[i] + ", " + mdxSets[i + 1] + ")");
		} else {
		    mdxAxis = getMdxCrossjoins(mdxSets);
		}


		if(ordersMap.axes.hasOwnProperty("dimensions")) {
			var order = ordersMap.axes.dimensions;
			var by = order.by;
			if(by.indexOf("[Measures].[") < 0)
				by = by + ".CurrentMember.Name";
			mdxAxis = "Order(" + mdxAxis + ", " + by + ", " + order.dir + ")";
		}

		if(settings.summary.grandTotal) {
			if(settings.summary.position == "top")
				mdxAxis = "Union(" + getMdxCrossjoins(mdxTotalMembers) + ", " + mdxAxis + ")";
			else if(settings.summary.position == "bottom")
				mdxAxis = "Union(" + mdxAxis + ", " + getMdxCrossjoins(mdxTotalMembers) + ")";
		}

		if(settings.measuresOnColumns)
			mdx["rows"] = mdxAxis;
		else
			mdx["columns"] = mdxAxis;


		var mdxMeasuresSet = "{";
    	$.each(definition.measures, function(i, v) {
     		 if(i > 0) mdxMeasuresSet += ", ";
     		 	mdxMeasuresSet += v[0];
      	});

    	mdxMeasuresSet += "}";

		if(ordersMap.levels.hasOwnProperty("[Measures]")) {
			var order = ordersMap.levels["[Measures]"];
			var by = order.by;
			var direction = order.dir;
			if(by == "name") {
				mdxMeasuresSet = "Order(" + mdxMeasuresSet + ", [Measures].CurrentMember.Name, " + direction + ")";
			}
		}


    	mdx["sets"].push("set [Measures_Set] as '" + mdxMeasuresSet + "'");


    	mdxSets = [];
		mdxTotalMembers = [];

		$.each(pivotHierarchies, function(i, hierarchy) {
			var lastLevel = hierarchy.levels[hierarchy.levels.length-1];

			if(settings.summary.pivotGrandTotal || settings.summary.pivotSubTotals) {
				mdx["members"].push("member [" + hierarchy.name + "].[BT_TOTAL] as 'Aggregate([" + lastLevel.hierarchy + "_" + lastLevel.name + "_Set])'");
				mdxTotalMembers.push("[" + hierarchy.name + "].[BT_TOTAL]");
			}

			var previousLevelName = [];
			var previousLevelAllMembers = [];

			$.each(hierarchy.levels, function(j, level) {
				var mdxFilteredSet = getMdxFilter(level.qualifiedName, "[" + hierarchy.name + "]");
				var mdxNamedSet = mdxFilteredSet == "" ? "{" + level.qualifiedName + ".Members}" : mdxFilteredSet;

				if(j > 0) {
					var mdxConditions = [];
					$.each(previousLevelName, function(k, previousLevelName) {
						if(!previousLevelAllMembers[k])
							mdxConditions.push("(Exists(Ancestor([" + level.hierarchy + "].CurrentMember, [" + level.hierarchy + "].[" + previousLevelName + "]), [" + level.hierarchy + "_" + previousLevelName + "_Set]).Count > 0))");
					});

					if(mdxConditions.length > 0) {
						mdxNamedSet = "Filter(" + mdxNamedSet + ", ";
						mdxNamedSet += "(" + mdxConditions.join(" AND ") + ")";
						mdxNamedSet += ")";
					}
				}

				if(ordersMap.levels.hasOwnProperty(level.qualifiedName)) {
					var order = ordersMap.levels[level.qualifiedName];
					var by = order.by;
					if(by == "name") {
						by = level.qualifiedName + ".CurrentMember.Name";
					}
					var direction = order.dir;
					mdxNamedSet = "Order(" + mdxNamedSet + ", " + by + ", " + direction + ")";
				}

				mdx["sets"].push("set [" + level.hierarchy + "_" + level.name + "_Set] as '" + mdxNamedSet + "'");

				previousLevelName.push(level.name);
				previousLevelAllMembers.push(mdxFilteredSet == "" ? true : false);
			});

			var mdxHierarchySet = "[" + lastLevel.hierarchy + "_" + lastLevel.name + "_Set]";
			if(hierarchy.levels.length > 1)
				mdxHierarchySet = "Descendants(" + mdxHierarchySet + ", " + lastLevel.qualifiedName + ", SELF)";

			if(settings.summary.pivotSubTotals && (i > 0 || pivotHierarchyBeforeMeasures == "NONE") && i == pivotHierarchies.length - 1 && !ordersMap.axes.hasOwnProperty("measures")) {
				if(settings.summary.position == "top")
					mdxHierarchySet = "Union([" + hierarchy.name + "].[BT_TOTAL], " + mdxHierarchySet + ")";
				else if(settings.summary.position == "bottom")
					mdxHierarchySet = "Union(" + mdxHierarchySet + ", [" + hierarchy.name + "].[BT_TOTAL])";
			}

			mdxSets.push(mdxHierarchySet);
		});


		if(pivotHierarchyBeforeMeasures == "") {
			mdxSets.push("[Measures_Set]");
			mdxTotalMembers.push("[Measures_Set]");
		}
		else {
			var measuresInsertionIndex = $.map(pivotHierarchies, function(hierarchy, index) {
			      if(hierarchy.name == pivotHierarchyBeforeMeasures)
			    	  return index + 1;
			});
			if(measuresInsertionIndex.length == 0 && pivotHierarchyBeforeMeasures == "NONE")
				measuresInsertionIndex = [0]

			mdxSets.splice(measuresInsertionIndex[0], 0, "[Measures_Set]");
			mdxTotalMembers.splice(measuresInsertionIndex[0], 0, "[Measures_Set]");
		}


		if(definition.pivotDimensions.length > 0) {

            if(settings.summary.pivotSubTotals && !ordersMap.axes.hasOwnProperty("measures") && mdxSets.length > 2) {
                var btTotals = mdxTotalMembers.slice();
                mdxAxis = "{?}";
                var i = 0;
                for(i; i < mdxSets.length - 2; i++) {
                    btTotals.shift();
                    mdxAxis = mdxAxis.replace("{?}", "Crossjoin(" + mdxSets[i] + ", Union({?}, " + getMdxCrossjoins(btTotals) + "))");
                }
                mdxAxis = mdxAxis.replace("{?}", "Crossjoin(" + mdxSets[i] + ", " + mdxSets[i + 1] + ")");
            } else {
    			mdxAxis = getMdxCrossjoins(mdxSets);
            }


			if(ordersMap.axes.hasOwnProperty("measures")) {
				var order = ordersMap.axes.measures;
				var by = order.by;
				if(by == "name")
					by = "[Measures]";
				by += ".CurrentMember.Name";
				mdxAxis = "Order(" + mdxAxis + ", " + by + ", " + order.dir + ")";
			}

			if(settings.summary.pivotGrandTotal) {
				if(settings.summary.position == "top")
					mdxAxis = "Union(" + getMdxCrossjoins(mdxTotalMembers) + ", " + mdxAxis + ")";
				else if(settings.summary.position == "bottom")
					mdxAxis = "Union(" + mdxAxis + ", " + getMdxCrossjoins(mdxTotalMembers) + ")";
			}
		} else {
			mdxAxis = "[Measures_Set]";

			if(ordersMap.axes.hasOwnProperty("measures")) {
				var order = ordersMap.axes.measures;
				var by = order.by;
				if(by == "name") {
					by = "[Measures].CurrentMember.Name";
					mdxAxis = "Order(" + mdxAxis + ", " + by + ", " + order.dir + ")";
				}
			}
		}

		if(settings.measuresOnColumns)
			mdx["columns"] = mdxAxis;
		else
			mdx["rows"] = mdxAxis;


    	mdxSets = [];
		mdxTotalMembers = [];

		$.each(filterHierarchies, function(i, hierarchy) {
			var previousLevelName = [];
			var previousLevelAllMembers = [];

			$.each(hierarchy.levels, function(j, level) {
				var mdxFilteredSet = getMdxFilter(level.qualifiedName, "[" + hierarchy.name + "]");
				var mdxNamedSet = mdxFilteredSet == "" ? "{" + level.qualifiedName + ".Members}" : mdxFilteredSet;

				if(j > 0) {
					var mdxConditions = [];
					$.each(previousLevelName, function(k, previousLevelName) {
						if(!previousLevelAllMembers[k])
							mdxConditions.push("(Exists(Ancestor([" + level.hierarchy + "].CurrentMember, [" + level.hierarchy + "].[" + previousLevelName + "]), [" + level.hierarchy + "_" + previousLevelName + "_Set]).Count > 0))");
					});

					if(mdxConditions.length > 0) {
						mdxNamedSet = "Filter(" + mdxNamedSet + ", ";
						mdxNamedSet += "(" + mdxConditions.join(" AND ") + ")";
						mdxNamedSet += ")";
					}
				}

				mdx["sets"].push("set [" + level.hierarchy + "_" + level.name + "_Set] as '" + mdxNamedSet + "'");

				previousLevelName.push(level.name);
				previousLevelAllMembers.push(mdxFilteredSet == "" ? true : false);
			});

			if(!(previousLevelAllMembers.length == 1 && previousLevelAllMembers[0])) {
				var levelSets = $.map(hierarchy.levels, function(level) {
					return "[" + level.hierarchy + "_" + level.name + "_Set]";
				});
	
				var mdxHierarchySet = "{" + levelSets[levelSets.length - 1] + "}";
	
				mdxSets.push(mdxHierarchySet);
			}
		});

		mdx["slicer"] = getMdxCrossjoins(mdxSets);


    	var mdxQuery = "with ";
    	mdxQuery += mdx["sets"].join(" ") + " ";
    	mdxQuery += mdx["members"].join(" ") + " ";
    	mdxQuery += "select" + (settings.nonEmpty.columns ? " NON EMPTY" : "") + " " + mdx["columns"] + " on COLUMNS,";
    	mdxQuery += (settings.nonEmpty.rows ? " NON EMPTY" : "") + " " + mdx["rows"] + " on ROWS ";
    	mdxQuery += "from [" + mdx["cube"] + "]";
    	mdxQuery += mdx["slicer"] != "" ? " where (" + mdx["slicer"] + ")" : "";


  	    return mdxQuery;
    }


    myself.putMeasuresOnColumns = function() {
  		settings.measuresOnColumns = true;
    }

    myself.putMeasuresOnRows = function() {
  		settings.measuresOnColumns = false;
    }

    myself.hasMeasuresOnColumns = function() {
    	return settings.measuresOnColumns;
    }

    myself.hasPivotDimensions = function() {
    	if(definition.pivotDimensions.length == 0 || (definition.pivotDimensions.length == 1 && definition.pivotDimensions[0][0] == "MEASURES"))
    		return false;
    	else
    		return true;
    }


    myself.getDimensionQualifiedNames = function() {
    	return $.map(definition.dimensions, function(i) {return i[0]});
    }

    myself.getPivotDimensionQualifiedNames = function() {
    	return $.map(definition.pivotDimensions, function(i) {return i[0]});
    }

    myself.getMeasureQualifiedNames = function() {
    	return $.map(definition.measures, function(i) {return i[0]});
    }

    myself.getFilterQualifiedNames = function() {
    	return $.map(definition.filters, function(i) {return i[0]});
    }


    myself.getCube = function() {
    	return definition.cube;
    }

    myself.getFilters = function() {
    	var filters = [];

		var invalidHierarchies = $.map(myself.getDimensionQualifiedNames(), function(e) {
			return (e.split("].[")[0] + "]").replace("]]", "]");
		}).concat($.map(myself.getPivotDimensionQualifiedNames(), function(e) {
			return (e.split("].[")[0] + "]").replace("]]", "]");
		}));

		var boundToDashboard = filtersMap.synchronizedByParameters;

		for(var key in filtersMap.hierarchies) {
			if($.inArray(key, invalidHierarchies) < 0) {
				var hierarchy = filtersMap.hierarchies[key];
				var levels = hierarchy.levels;
				$.each(hierarchy.order, function(i, v) {
					var level = levels[v];
					if(level.filtered) {
						var qn = v;
						var filterMode = level.filterMode;
						if(level.uniqueNames) filterMode += "_un";
				    	var members = null;

						if(boundToDashboard && level.synchronizedByParameters) {
					    	var filterExpression = level.initialFilterExpression;
					    	var param = filterExpression.replace(filterMode + ":", "");
							var members = Dashboards.getParameterValue(param);
			    		} else {
			    			members = level.members;
			    		}
						
						if(members.length > 0) {
							var plainFilter = filterMode + ":[" + ( $.isArray(members) ? members.join("],[") : members ) + "]";
							var filter = [qn, plainFilter];
	
							filters.push(filter);
						}
					}
				});
			}
		}

		return filters;
    }

    myself.getDimensions = function() {
		var dimensions = [];
		$.each(definition.dimensions, function(i, v) {
			var qn = v[0];
			var arr = [qn, myself.getPlainFilter(qn)];
			dimensions.push(arr);
		});
		return dimensions;
    }

    myself.getPivotDimensions = function() {
		var pivotDimensions = [];
		$.each(definition.pivotDimensions, function(i, v) {
			var qn = v[0];
			var fe = qn == "MEASURES" ? "" : myself.getPlainFilter(qn);
			var arr = [qn, fe];
			pivotDimensions.push(arr);
		});
		return pivotDimensions;
    }

    myself.getMeasures = function() {
    	return definition.measures;
    }

    myself.setMeasures = function(measures) {
    	definition.measures = measures;
    }

    myself.set = function(properties) {
    	$.extend(true, settings, properties);
    }

    myself.getSettings = function() {
    	return settings;
    }

    myself.isRemovable = function(qualifiedName, type) {
    	var removable = true;

    	if(type == "D") {
    		removable = definition.dimensions.length > 1;

    		if(removable) {
    			// prevent removing a dimension level if there is only one hierarchy in the axis
    			// and moving all the levels of this hierarchy in filters make this axis empty!
    			var hierarchies = _.uniq($.map(myself.getDimensionQualifiedNames(), function(e) {
    				return (e.split("].[")[0] + "]").replace("]]", "]");
    			}));

    			if(hierarchies.length == 1) {
    				if(filtersMap.hierarchies[hierarchies[0]].levels[qualifiedName].filtered)
    					removable = false;
    			}
    		}
    	}
    	else if(type == "M") {
    		removable = definition.measures.length > 1;
    	}

    	return removable;
    }

    myself.remove = function(qualifiedName, type) {
    	var removedElements = undefined;

    	var hierarchy = (qualifiedName.split("].[")[0] + "]").replace("]]", "]");

    	var axis = [];
    	var axisQualifiedNames = [];

    	if(type == "D") {
    		axis = definition.dimensions;
    		axisQualifiedNames = myself.getDimensionQualifiedNames();
    	}
    	else if(type == "M") {
    		axis = definition.measures;
    		axisQualifiedNames = myself.getMeasureQualifiedNames();
    	}
    	else if(type == "P") {
    		axis = definition.pivotDimensions;
    		axisQualifiedNames = myself.getPivotDimensionQualifiedNames();
    	}

    	var index = -1;
    	var length = 0;

    	// also remove all other levels of the same hierarchy if the target level is filtered!
    	if(type != "M" && filtersMap.hierarchies[hierarchy].levels[qualifiedName].filtered) {
    		var hierarchies = $.map(axisQualifiedNames, function(e) {
    			return (e.split("].[")[0] + "]").replace("]]", "]");
    		});
    		var indexes = [];
    		$.each(hierarchies, function(i, v) {
    			if(v == hierarchy) indexes.push(i);
    		});

    		//console.log(indexes.toSource());

    		index = indexes[0];
    		length = indexes.length;
    	} else {
    		index = axisQualifiedNames.indexOf(qualifiedName);
    		length = 1;
    	}

    	if(index >= 0)
    		removedElements = axis.splice(index, length);

    	myself.clearSort(qualifiedName, (length > 1 ? true : false));
    }

    myself.add = function(newQualifiedName, targetQualifiedName, position, type) {
    	var hierarchy = (newQualifiedName.split("].[")[0] + "]").replace("]]", "]");

    	var axis = [];
    	var axisQualifiedNames = [];

    	if(type == "D") {
    		axis = definition.dimensions;
    		axisQualifiedNames = myself.getDimensionQualifiedNames();
    	}
    	else if(type == "M") {
    		axis = definition.measures;
    		axisQualifiedNames = myself.getMeasureQualifiedNames();
    	}
    	else if(type == "P") {
    		axis = definition.pivotDimensions;
    		if($.inArray("MEASURES", myself.getPivotDimensionQualifiedNames()) < 0)
    			axis.splice(0, 0, ["MEASURES", ""]);
    		axisQualifiedNames = myself.getPivotDimensionQualifiedNames();
    	}

		var index = $.inArray(targetQualifiedName, axisQualifiedNames);

    	// also add all other levels of the same hierarchy if they are filtered and they aren't in the axis!
		var hierarchies = $.map(axisQualifiedNames, function(e) {
			return (e.split("].[")[0] + "]").replace("]]", "]");
		});

		if(type != "M" && $.inArray(hierarchy, hierarchies) < 0) {
			var fmHierarchy = filtersMap.hierarchies[hierarchy];
    		var fmLevels = fmHierarchy.levels;

    		var elementsToInsert = [];

			$.each(fmHierarchy.order, function(i, v) {
    			if(fmLevels[v].filtered || v == newQualifiedName)
    				elementsToInsert.push("[\"" + v + "\", \"\"]");
    		});

			if(index >= 0) {
        		if(position == 1)
        			index++;
        		
        		eval("axis.splice(index, 0, " + elementsToInsert.join(", ") + ")");
        	}
    	} else {
    		var elementToInsert = [newQualifiedName, ""];
        	if(index >= 0) {
        		if(position == 1)
        			index++;
        		axis.splice(index, 0, elementToInsert);
        	}
    	}
    }

    myself.isReplaceable = function(newQualifiedName, oldQualifiedName, type) {
    	var replaceable = true;

    	if(type != "M") {
    		var newHierarchy = (newQualifiedName.split("].[")[0] + "]").replace("]]", "]");
    		var oldHierarchy = (oldQualifiedName.split("].[")[0] + "]").replace("]]", "]");

    		if(newHierarchy == oldHierarchy && filtersMap.hierarchies[oldHierarchy].levels[oldQualifiedName].filtered)
    			replaceable = false;
    	}

    	return replaceable;
    }

    myself.replace = function(newQualifiedName, oldQualifiedName, position, type) {    	
    	var hasNewPosition = position != null;
    	var closeQualifiedName = hasNewPosition ? position.level : oldQualifiedName;
    	var direction = hasNewPosition ? position.direction : 1;

    	var axis = [];
    	var axisQualifiedNames = [];

    	if(type == "D") {
    		axis = definition.dimensions;
    		axisQualifiedNames = myself.getDimensionQualifiedNames();
    	}
    	else if(type == "M") {
    		axis = definition.measures;
    		axisQualifiedNames = myself.getMeasureQualifiedNames();
    	}
    	else if(type == "P") {
    		axis = definition.pivotDimensions;
    		axisQualifiedNames = myself.getPivotDimensionQualifiedNames();
    	}

    	//console.log("Add " + newQualifiedName + " to the " + (direction == 1 ? "right of " : "left of ") + closeQualifiedName + ". Then remove " + oldQualifiedName);

		myself.add(newQualifiedName, closeQualifiedName, direction, type);
		myself.remove(oldQualifiedName, type);

        if(type != "M") {
            var newLevelHierarchy = (newQualifiedName.split("].[")[0] + "]").replace("]]", "]");
            var oldLevelHierarchy = (oldQualifiedName.split("].[")[0] + "]").replace("]]", "]");
            var closeLevelHierarchy = (closeQualifiedName.split("].[")[0] + "]").replace("]]", "]");
            if(closeQualifiedName != oldQualifiedName && closeLevelHierarchy == oldLevelHierarchy && newLevelHierarchy != oldLevelHierarchy) {
                // positioning correction
                var headElements = [];
                var tailElements = [];
                var newHierarchyElements = [];
                var oldHierarchyElements = [];
                var newHierarchyFound = false;
                $.each(axis, function(i, v) {
                    var l = v[0];
                    var h = (l.split("].[")[0] + "]").replace("]]", "]");
                    var e  = "[\"" + l + "\", \"\"]";
                    if(h == oldLevelHierarchy) {
                        oldHierarchyElements.push(e);
                    }
                    else if(h == newLevelHierarchy) {
                        newHierarchyElements.push(e);
                        newHierarchyFound = true;
                    }
                    else {
                        if(!newHierarchyFound)
                            headElements.push(e);
                        else
                            tailElements.push(e);
                    }
                });
                var newAxis = headElements.concat(newHierarchyElements, oldHierarchyElements, tailElements);
                eval("axis.splice(0, axis.length, " + newAxis.join(", ") + ")");
            }
        }
	}


    var filtersMap = {
    	synchronizedByParameters: true,
    	hierarchies: []
    };

    if(olapCube && olapCube.getStructure()) {
    	var hierarchies = olapCube.getHierarchies();
    	$.each(hierarchies, function(i, v) {
    		var levels = [];
    		var order = [];
    		$.each(v.levels, function(j, w) {
    			var qualifiedName = w.qualifiedName;
    			levels[qualifiedName] = {
    				depth: w.depth,
    				initialFilterExpression: "",
    				synchronizedByParameters: false,
    				filterMode: "",
    				uniqueNames: false,
    				members: [],
    				filtered: false
    			}
    			order.push(qualifiedName);
    		});
        	filtersMap.hierarchies[v.qualifiedName] = {
        		levels: levels,
        		order: order,
        		calculatedMembers: {
    				initialFilterExpression: "",
    				synchronizedByParameters: false,
    				filterMode: "",
    				//uniqueNames: false,
    				members: [],
    				filtered: false
        		}
        	}
    	});
    }

    var initializeFiltersMap = function(axis) {
		if(olapCube && olapCube.getStructure()) {
			$.each(axis, function(i, v) {
				var lvlQn = v[0];
				var fltExpr = v[1];
				if(fltExpr != "") {
					if(lvlQn.indexOf("].[") < 0) {
						var hrcQn = lvlQn;
						var synchronizedByParameters = fltExpr.indexOf("[") < 0;
						var filterMode = synchronizedByParameters ? fltExpr.split(":")[0] : fltExpr.split(":[")[0];
						var membersString = synchronizedByParameters ? "" : fltExpr.replace(filterMode + ":", "");
						var calculatedMembers = filtersMap.hierarchies[hrcQn].calculatedMembers;
						calculatedMembers.initialFilterExpression = fltExpr;
						calculatedMembers.synchronizedByParameters = synchronizedByParameters;
						calculatedMembers.filterMode = filterMode;
						calculatedMembers.members = synchronizedByParameters ? [] : membersString.substring(1, membersString.length - 1).split("],[");
						calculatedMembers.filtered = true;
					} else {
						var hrcQn = lvlQn.split("].[")[0] + "]";
						var levels = filtersMap.hierarchies[hrcQn].levels;
						var synchronizedByParameters = fltExpr.indexOf("[") < 0;
						var filterMode = synchronizedByParameters ? fltExpr.split(":")[0] : fltExpr.split(":[")[0];
						var membersString = synchronizedByParameters ? "" : fltExpr.replace(filterMode + ":", "");
						var level = filtersMap.hierarchies[hrcQn].levels[lvlQn];
						level.initialFilterExpression = fltExpr;
						level.synchronizedByParameters = synchronizedByParameters;
						level.filterMode = filterMode.replace("_un", "");
						level.uniqueNames = filterMode.indexOf("_un") > -1;
						level.members = synchronizedByParameters ? [] : membersString.substring(1, membersString.length - 1).split("],[");
						level.filtered = true;
					}
				}
			});
		}
	}

    initializeFiltersMap(definition.dimensions);
    initializeFiltersMap(definition.pivotDimensions);
    initializeFiltersMap(definition.filters);

    myself.getFiltersMap = function() {
    	return filtersMap;
    }

    myself.synchronizeFiltersWithParameters = function(state) {
    	filtersMap.synchronizedByParameters = state;
    }

    myself.isSynchronizedByParameters = function() {
    	return filtersMap.synchronizedByParameters;
    }

    myself.setFiltersMap = function(hierarchyQualifiedName, levelQualifiedName, filter) {
    	$.extend(filtersMap.hierarchies[hierarchyQualifiedName].levels[levelQualifiedName], filter);
    }


    var ordersMap = {
        axes: {},
        levels: []
    };

    var initializeOrdersMap = function() {
        $.each(definition.orders, function(i, v) {
        	var arg = v[0];
        	var valueParts = v[1].split("::");
        	var rule = {by: valueParts[0], dir: valueParts[1]};

        	if(arg == "D")
        		ordersMap.axes.dimensions = rule;
        	else if(arg == "M")
        		ordersMap.axes.measures = rule;
        	else
        		ordersMap.levels[arg] = rule;
        });
    }

    initializeOrdersMap();

    myself.getOrdersMap = function() {
    	return ordersMap;
    }

    myself.getSortDirection = function(target, qualifiedName) {
    	var direction = "";
    	if(target == "D") {
    		if(ordersMap.axes.hasOwnProperty("dimensions")) {
    			var order = ordersMap.axes.dimensions;
    			if(order.by == qualifiedName)
    				direction = order.dir;
    		}
    	}
    	else if(target == "M") {
    		if(ordersMap.axes.hasOwnProperty("measures")) {
    			var order = ordersMap.axes.measures;
    			if(order.by == qualifiedName)
    				direction = order.dir;
    		}
    	}
    	/*else {

    	}*/
    	return direction;
    }

    myself.sort = function(target, by, direction) {
    	var removeSort = by == "";

    	if(target == "D") {
    		if(removeSort)
    			delete ordersMap.axes.dimensions;
    		else
    			ordersMap.axes.dimensions = {by: by, dir: direction};
    	}
    	else if(target == "M") {
    		if(removeSort)
    			delete ordersMap.axes.measures;
    		else
    			ordersMap.axes.measures = {by: by, dir: direction};
    	}
    }

    myself.clearSort = function(qualifiedName, hierarchyRemoval) {
    	var hierarchy = (qualifiedName.split("].[")[0] + "]").replace("]]", "]");

    	if(ordersMap.axes.hasOwnProperty("dimensions") && (
    		(!hierarchyRemoval && ordersMap.axes.dimensions.by == qualifiedName) ||
    		(hierarchyRemoval && ordersMap.axes.dimensions.by.indexOf(hierarchy) == 0)
    	))
    		delete ordersMap.axes.dimensions;

    	else if(ordersMap.axes.hasOwnProperty("measures") && (
       		(!hierarchyRemoval && ordersMap.axes.measures.by == qualifiedName) ||
       		(hierarchyRemoval && ordersMap.axes.measures.by.indexOf(hierarchy) == 0)
        ))
    		delete ordersMap.axes.measures;

    	if(hierarchyRemoval) {
    		for(key in ordersMap.levels) {
    			if(key.indexOf(hierarchy) == 0)
    				delete ordersMap.levels[key];
    		}
    	} else {
	    	if(ordersMap.levels.hasOwnProperty(qualifiedName))
	    		delete ordersMap.levels[qualifiedName];
    	}
    }

    return myself;
}
