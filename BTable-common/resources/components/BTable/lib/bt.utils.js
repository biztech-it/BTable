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
		var filters = _args.filters;
		// Remove current dimension from filters
		for(var i = 0; i < filters.length; i++) {
			var filter = filters[i];
			if(filter[0] == level) {
				filters.splice(i, 1);
				break;
			}
		} 

		var olapCube = new bt.olap.OlapCube({
			catalog: myself.options.catalog,
			cube: cube,
			jndi: myself.options.jndi
		});

		var levelDimension = [[level, ""]];
		var query = new bt.Query({
			cube: cube,
			dimensions: levelDimension, 
			filters: filters,
			summary: {},
			orders: []
		}, olapCube);
		//var mdxQuery = "with member [Measures].[Unique Name] as '" + level + ".CurrentMember.UniqueName' select distinct(" + level + ".Members) on Rows, {[Measures].[Unique Name]} ON Columns from [" + cube + "]"; 
		var mdxQuery = query.getLevelFilterMdx(level);

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
			//for(var i = 2; i < v.length; i++) {
			//if(v[i]!== null) {
			members.push({name: v[0] , qualifiedName: v[1]});
			//	break;
			//}
			//} 
		});

		return {members: members};

	};    

	return myself;

}

function runEndpoint(pluginId, endpoint, opts) {

	if (!pluginId && !endpoint) {
		Dashboards.log('PluginId or endpointName not defined.');
		return false
	}

	var _opts = {
			success: function () {
				Dashboards.log(pluginId + ': ' + endpoint + ' ran successfully.')
			},
			error: function (){
				Dashboards.log(pluginId + ': error running ' + endpoint + '.')
			},
			params: {},
			systemParams: {},
			type: 'POST',
			dataType: 'json'
	}
	var opts = $.extend( {}, _opts, opts);
	var url = Dashboards.getWebAppPath() + '/plugin/' + pluginId + '/api/' + endpoint;
	function successHandler (json) {
		if (json && json.result == false) {
			opts.error.apply(this, arguments);
		} else {
			opts.success.apply( this, arguments );
		}
	}
	function errorHandler () {
		opts.error.apply(this, arguments);
	}

	if (endpoint != 'renderer/refresh' ) {
		var ajaxOpts = {
				url: url,
				async: true,
				type: opts.type,
				dataType: opts.dataType,
				success: successHandler,
				error: errorHandler,
				data: {}
		}
	} else {
		var ajaxOpts = {
				url: url,
				async: true,
				type: 'GET',
				dataType: opts.dataType,
				success: successHandler,
				error: errorHandler,
				data: {}
		}
	}
	_.each( opts.params , function ( value , key) {
		ajaxOpts.data['param' + key] = value;
	});

	_.each(opts.systemParams , function (value , key) {
		ajaxOpts.data[key] = value;
	});
	$.ajax(ajaxOpts)
};


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

function getLocalizedFormattedValue(formatString, valueString) {
	var formattedValueString = valueString;

	var testZeroValue = function(v) {
		var n = parseFloat(v);
		return isNaN(n) || n == 0;
	};

	switch(formatString.toLowerCase()) {
	case "": return valueString;
	case "none": return valueString;
	case "general number": formatString = "0.00"; break;
	case "currency": formatString = "#,##0.00"; break;
	case "fixed":  formatString = "0,.00####"; break;
	case "standard": formatString = "#,##0"; break;
	case "percent": formatString = "0.00%"; break;
	case "scientific": formatString = "0.00e+00"; break;
	case "yes/no": return testZeroValue(valueString) ? "No" : "Yes";
	case "true/false": return testZeroValue(valueString) ? "False" : "True";
	case "on/off": return testZeroValue(valueString) ? "Off" : "On";
	default: break;
	}

	var formatStringSections = [];

	// if formatString contains a conditional expression, get the first occurrence of a format
	var re = new RegExp(/\|[^|]*\|/);
	var match = re.exec(formatString);

	// get 4 sections from formatString: the first section applies to positive values, the second to negative values, the third to zeros, and the fourth to null values
	if(match == null) {
		var formatExpressions = formatString.split(";");
		formatStringSections[0] = formatExpressions[0];
		formatStringSections[1] = formatExpressions[1] === undefined || formatExpressions[1] === "" ? "-" + formatExpressions[0] : formatExpressions[1];
		formatStringSections[2] = formatExpressions[2] === undefined || formatExpressions[2] === "" ? formatExpressions[0] : formatExpressions[2];
		formatStringSections[3] = formatExpressions[3] === undefined ? "" : formatExpressions[3];
	} else {
		var formatExpression = match[0].substring(1, match[0].length - 1).replace(/[-()]/g, "").replace("+", ""); 
		formatStringSections[0] = formatExpression;
		formatStringSections[1] = "-" + formatExpression;
		formatStringSections[2] = formatExpression;
		formatStringSections[3] = "";
	}

	var valueNumber = parseFloat(valueString);
	var selectedFormatSection = formatStringSections[3];

	if(!isNaN(valueNumber)) {
		if(valueNumber > 0)
			selectedFormatSection = formatStringSections[0];
		else if(valueNumber < 0)
			selectedFormatSection = formatStringSections[1];
		else if(valueNumber == 0)
			selectedFormatSection = formatStringSections[2];

		valueNumber = Math.abs(valueNumber);

		if(selectedFormatSection.indexOf("%") > -1)
			valueNumber = valueNumber * 100;		
	}

	var scientificFormat = false;
	var eChar = "e";
	var eSign = "+";
	var eDigits = "";
	var exponent = null;
	var originalSelectedFormatSection = selectedFormatSection;
	var originalFormat = "";

	var re1 = new RegExp(/[#0,.]*[eE][+-][0#]+/);
	if(re1.test(selectedFormatSection)) {
		scientificFormat = true;

		var match1 = re1.exec(selectedFormatSection);
		originalFormat = match1[0];
		if(originalFormat.indexOf("E") > -1)
			eChar = "E";
		if(originalFormat.indexOf("-") > -1)
			eSign = "-";
		var eSides = selectedFormatSection.split(eChar + eSign);
		selectedFormatSection = eSides[0];
		eDigits = eSides[1];

		var exponentialParts = (valueNumber.toExponential() + "").split("e");
		valueNumber = parseFloat(exponentialParts[0]);
		var exponent = parseInt(exponentialParts[1]);
	}

	var re2 = new RegExp(/[#0,.]+/);
	var match2 = re2.exec(selectedFormatSection);
	var format = match2 == null ? "" : match2[0];

	if(format != "") {		
		// scale number
		var formatParts = format.split(".");
		var re3 = new RegExp(/[,]+$/);
		var match3 = re3.exec(formatParts[0]);
		var formatHasScalingFactor = match3 != null;
		if(formatHasScalingFactor) {
			var divisor = Math.pow(10, match3[0].length * 3);
			valueNumber = valueNumber / divisor;
		}
		var formatWithoutScalingFactor = formatHasScalingFactor ? (formatParts[0].replace(re3, "") + (formatParts.length > 1 ? ("." + formatParts[1]) : "")) : format;

		var re4 = new RegExp(/\.[#0]+/);
		var match4 = re4.exec(format);
		var formatHasDecimals = match4 != null;
		var formatDecimalsCount = formatHasDecimals ? match4[0].length - 1 : 0;
		var formatMandatoryDecimalsCount = !formatHasDecimals || match4[0].lastIndexOf("0") < 0 ? 0 : match4[0].lastIndexOf("0");

		valueNumber = valueNumber.toFixed(formatDecimalsCount);

		var formattedNumber = valueNumber + "";

		var numberParts = formattedNumber.split('.');
		var integerPart = numberParts[0];
		var decimalPart = numberParts.length > 1 ? numberParts[1] : "";

		if(formatHasDecimals) {
			var numberDecimalsCount = decimalPart.length;
			if(numberDecimalsCount < formatMandatoryDecimalsCount) { // add leading zeros
				for(var i = numberDecimalsCount; i < formatMandatoryDecimalsCount; i++)
					decimalPart += "0";
			} else { // remove leading zeros
				var gap = numberDecimalsCount - formatMandatoryDecimalsCount;
				while(gap > 0) {
					decimalPart = decimalPart.replace(eval(/[0]$/), "");
					gap--;
				}
			}
		}

		var formatHasThousandsSeparators = formatWithoutScalingFactor.indexOf(",") > -1;
		var formatIntegerPart = formatWithoutScalingFactor.split(".")[0];
		var reversedFormatIntegerPart = formatIntegerPart.split("").reverse().join("");
		var formatMandatoryIntegerPartLength = reversedFormatIntegerPart.lastIndexOf("0") < 0 ? 0 : reversedFormatIntegerPart.lastIndexOf("0") + 1;

		var numberIntegerPartLength = integerPart.length;
		if(integerPart == "0" && formatMandatoryIntegerPartLength == 0) // remove trailing zeros
			integerPart = "";
		else if(numberIntegerPartLength < formatMandatoryIntegerPartLength) { // add trailing zeros
			for(var i = numberIntegerPartLength; i < formatMandatoryIntegerPartLength; i++)
				integerPart = "0" + integerPart;
		}

		var separators = getNumberSeparators(navigator.language || navigator.userLanguage);

		if(formatHasThousandsSeparators) {
			var re5 = /(\d+)(\d{3})/;
			while (re5.test(integerPart))
				integerPart = integerPart.replace(re5, '$1' + separators.thousands + '$2');
		}

		formattedNumber = integerPart + (decimalPart.length > 0 ? separators.decimals + decimalPart : "");

		formattedValueString = formattedNumber.length > 0 ? selectedFormatSection.replace(format, formattedNumber) : "";
	} else {
		formattedValueString = selectedFormatSection;
	}

	if(scientificFormat) {
		var exponentString = Math.abs(exponent) + "";
		for(var i = exponentString.length; i < eDigits; i++)
			exponentString = "0" + exponentString;
		var signChar = "";
		if(exponent < 0)
			signChar = "-";
		else {
			if(eSign == "+")
				signChar = "+";
		}
		var formattedNumber = formattedValueString + eChar + signChar + exponentString;
		formattedValueString = originalSelectedFormatSection.replace(originalFormat, formattedNumber);
	}

	return formattedValueString;
}


function getNumberSeparators(lang) {
	if(numberSeparatorsCache.hasOwnProperty(lang))
		return numberSeparatorsCache[lang];

	var langParts = lang.split("-");	
	var language = langParts[0].toLowerCase();
	var country = langParts.length > 1 ? langParts[1].toUpperCase() : "";

	var code = language + (country != "" ? "-" : "") + country;

	var separators = {thousands: ",", decimals: "."};

	if(format1Locales.indexOf(code) > -1) {
		separators = {thousands: ",", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if(format2Locales.indexOf(code) > -1) {
		separators = {thousands: ".", decimals: ","};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}		
	if(format3Locales.indexOf(code) > -1) {
		separators = {thousands: "'", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if(format4Locales.indexOf(code) > -1) {
		separators = {thousands: " ", decimals: ","};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if(format5Locales.indexOf(code) > -1) {
		separators = {thousands: ",", decimals: "/"};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if(format6Locales.indexOf(code) > -1) {
		separators = {thousands: " ", decimals: "-"};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if(format7Locales.indexOf(code) > -1) {
		separators = {thousands: " ", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}

	if($.map(format1Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: ",", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format2Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: ".", decimals: ","};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format3Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: "'", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format4Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: " ", decimals: ","};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format5Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: ",", decimals: "/"};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format6Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: " ", decimals: "-"};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}
	if($.map(format7Locales, function(v, i) {return v.split("-")[0].toLowerCase();}).indexOf(language) > -1) {
		separators = {thousands: " ", decimals: "."};
		numberSeparatorsCache[lang] = separators;
		return separators;
	}

	numberSeparatorsCache[lang] = separators;
	return separators;
}

var numberSeparatorsCache = {};

/*
 * http://www.codeproject.com/Articles/78175/International-Number-Formats
 */
var format1Locales = [ // 1,234.56	
                       "", // Invariant Language (Invariant Country)
                       "ar-SA", // Arabic (Saudi Arabia)
                       "zh-TW", // Chinese (Taiwan)
                       "en-US", // English (United States)
                       "he-IL", // Hebrew (Israel)
                       "ja-JP", // Japanese (Japan)
                       "ko-KR", // Korean (Korea)
                       "th-TH", // Thai (Thailand)
                       "ur-PK", // Urdu (Islamic Republic of Pakistan)
                       "hy-AM", // Armenian (Armenia)
                       "af-ZA", // Afrikaans (South Africa)
                       "hi-IN", // Hindi (India)
                       "sw-KE", // Kiswahili (Kenya)
                       "pa-IN", // Punjabi (India)
                       "gu-IN", // Gujarati (India)
                       "ta-IN", // Tamil (India)
                       "te-IN", // Telugu (India)
                       "kn-IN", // Kannada (India)
                       "mr-IN", // Marathi (India)
                       "sa-IN", // Sanskrit (India)
                       "kok-IN", // Konkani (India)
                       "syr-SY", // Syriac (Syria)
                       "dv-MV", // Divehi (Maldives)
                       "ar-IQ", // Arabic (Iraq)
                       "zh-CN", // Chinese (People's Republic of China)
                       "en-GB", // English (United Kingdom)
                       "es-MX", // Spanish (Mexico)
                       "ar-EG", // Arabic (Egypt)
                       "zh-HK", // Chinese (Hong Kong S.A.R.)
                       "en-AU", // English (Australia)
                       "ar-LY", // Arabic (Libya)
                       "zh-SG", // Chinese (Singapore)
                       "en-CA", // English (Canada)
                       "es-GT", // Spanish (Guatemala)
                       "ar-DZ", // Arabic (Algeria)
                       "zh-MO", // Chinese (Macao S.A.R.)
                       "en-NZ", // English (New Zealand)
                       "ar-MA", // Arabic (Morocco)
                       "en-IE", // English (Ireland)
                       "es-PA", // Spanish (Panama)
                       "ar-TN", // Arabic (Tunisia)
                       "en-ZA", // English (South Africa)
                       "es-DO", // Spanish (Dominican Republic)
                       "ar-OM", // Arabic (Oman)
                       "en-JM", // English (Jamaica)
                       "ar-YE", // Arabic (Yemen)
                       "en-029", // English (Caribbean)
                       "ar-SY", // Arabic (Syria)
                       "en-BZ", // English (Belize)
                       "es-PE", // Spanish (Peru)
                       "ar-JO", // Arabic (Jordan)
                       "en-TT", // English (Trinidad and Tobago)
                       "ar-LB", // Arabic (Lebanon)
                       "en-ZW", // English (Zimbabwe)
                       "ar-KW", // Arabic (Kuwait)
                       "en-PH", // English (Republic of the Philippines)
                       "ar-AE", // Arabic (U.A.E.)
                       "ar-BH", // Arabic (Bahrain)
                       "ar-QA", // Arabic (Qatar)
                       "es-SV", // Spanish (El Salvador)
                       "es-HN", // Spanish (Honduras)
                       "es-NI", // Spanish (Nicaragua)
                       "es-PR", // Spanish (Puerto Rico)
                       "zu-ZA", // Zulu (South Africa)
                       "xh-ZA", // Xhosa (South Africa)
                       "tn-ZA", // Tswana (South Africa)
                       "quz-PE", // Quechua (Peru)
                       "cy-GB", // Welsh (United Kingdom)
                       "fil-PH", // Filipino (Philippines)
                       "iu-Latn-CA", // Inuktitut (Latin) (Canada)
                       "mi-NZ", // Maori (New Zealand)
                       "ga-IE", // Irish (Ireland)
                       "moh-CA", // Mohawk (Canada)
                       "ns-ZA", // Northern Sotho (South Africa)
                       "mt-MT" // Maltese (Malta)
                       ];

var format2Locales = [ // 1.234,56
                       "es", // Spanish

                       "ca-ES", // Catalan (Catalan)
                       "da-DK", // Danish (Denmark)
                       "de-DE", // German (Germany)
                       "el-GR", // Greek (Greece)
                       "is-IS", // Icelandic (Iceland)
                       "it-IT", // Italian (Italy)
                       "nl-NL", // Dutch (Netherlands)
                       "pt-BR", // Portuguese (Brazil)
                       "ro-RO", // Romanian (Romania)
                       "hr-HR", // Croatian (Croatia)
                       "sq-AL", // Albanian (Albania)
                       "sv-SE", // Swedish (Sweden)
                       "tr-TR", // Turkish (Turkey)
                       "id-ID", // Indonesian (Indonesia)
                       "sl-SI", // Slovenian (Slovenia)
                       "lt-LT", // Lithuanian (Lithuania)
                       "vi-VN", // Vietnamese (Vietnam)
                       "eu-ES", // Basque (Basque)
                       "mk-MK", // Macedonian (Former Yugoslav Republic of Macedonia)
                       "fo-FO", // Faroese (Faroe Islands)
                       "ms-MY", // Malay (Malaysia)
                       "gl-ES", // Galician (Galician)
                       "fr-BE", // French (Belgium)
                       "nl-BE", // Dutch (Belgium)
                       "pt-PT", // Portuguese (Portugal)
                       "sr-Latn-CS", // Serbian (Latin, Serbia)
                       "ms-BN", // Malay (Brunei Darussalam)
                       "de-AT", // German (Austria)
                       "es-ES", // Spanish (Spain)
                       "sr-Cyrl-CS", // Serbian (Cyrillic, Serbia)
                       "de-LU", // German (Luxembourg)
                       "es-CR", // Spanish (Costa Rica)
                       "es-VE", // Spanish (Venezuela)
                       "es-CO", // Spanish (Colombia)
                       "es-AR", // Spanish (Argentina)
                       "es-EC", // Spanish (Ecuador)
                       "es-CL", // Spanish (Chile)
                       "es-UY", // Spanish (Uruguay)
                       "es-PY", // Spanish (Paraguay)
                       "es-BO", // Spanish (Bolivia)
                       "sr-Cyrl-BA", // Serbian (Cyrillic) (Bosnia and Herzegovina)
                       "fy-NL", // Frisian (Netherlands)
                       "se-SE", // Sami (Northern) (Sweden)
                       "sma-SE", // Sami (Southern) (Sweden)
                       "hr-BA", // Croatian (Bosnia and Herzegovina)
                       "bs-Latn-BA", // Bosnian (Bosnia and Herzegovina)
                       "bs-Cyrl-BA", // Bosnian (Cyrillic) (Bosnia and Herzegovina)
                       "arn-CL", // Mapudungun (Chile)
                       "quz-EC", // Quechua (Ecuador)
                       "sr-Latn-BA", // Serbian (Latin) (Bosnia and Herzegovina)
                       "smj-SE", // Sami (Lule) (Sweden)
                       "quz-BO" // Quechua (Bolivia)
                       ];

var format3Locales = [ // 1'234.56
                       "de-CH", // German (Switzerland)
                       "it-CH", // Italian (Switzerland)
                       "fr-CH", // French (Switzerland)
                       "de-LI", // German (Liechtenstein)
                       "rm-CH" // Romansh (Switzerland)
                       ];

var format4Locales = [ // 1 234,56
                       "fr", // French
                       "no", // Norwegian

                       "bg-BG", // Bulgarian (Bulgaria)
                       "cs-CZ", // Czech (Czech Republic)
                       "fi-FI", // Finnish (Finland)
                       "fr-FR", // French (France)
                       "hu-HU", // Hungarian (Hungary)
                       "nb-NO", // Norwegian, Bokmål (Norway)
                       "pl-PL", // Polish (Poland)
                       "ru-RU", // Russian (Russia)
                       "sk-SK", // Slovak (Slovakia)
                       "uk-UA", // Ukrainian (Ukraine)
                       "be-BY", // Belarusian (Belarus)
                       "lv-LV", // Latvian (Latvia)
                       "az-Latn-AZ", // Azeri (Latin, Azerbaijan)
                       "ka-GE", // Georgian (Georgia)
                       "uz-Latn-UZ", // Uzbek (Latin, Uzbekistan)
                       "tt-RU", // Tatar (Russia)
                       "mn-MN", // Mongolian (Cyrillic, Mongolia)
                       "nn-NO", // Norwegian, Nynorsk (Norway)
                       "sv-FI", // Swedish (Finland)
                       "az-Cyrl-AZ", // Azeri (Cyrillic, Azerbaijan)
                       "uz-Cyrl-UZ", // Uzbek (Cyrillic, Uzbekistan)
                       "fr-CA", // French (Canada)
                       "fr-LU", // French (Luxembourg)
                       "fr-MC", // French (Principality of Monaco)
                       "sma-NO", // Sami (Southern) (Norway)
                       "smn-FI", // Sami (Inari) (Finland)
                       "se-FI", // Sami (Northern) (Finland)
                       "sms-FI", // Sami (Skolt) (Finland)
                       "smj-NO", // Sami (Lule) (Norway)
                       "lb-LU", // Luxembourgish (Luxembourg)
                       "se-NO" // Sami (Northern) (Norway)
                       ];

var format5Locales = [ // 1,234/56
                       "fa-IR" // Persian (Iran)
                       ];

var format6Locales = [ // 1 234-56
                       "kk-KZ", // Kazakh (Kazakhstan)
                       "ky-KG", // Kyrgyz (Kyrgyzstan)
                       ];

var format7Locales = [ // 1 234.56
                       "et-EE" // Estonian (Estonia)
                       ];


(function($) {
	$.fn.fixHeader = function() {
		return this.each(function() {
			var $this = $(this), $t_fixed;
			var $component = $("#" + $this.attr("id").replace("Table",""));

			var overflowX = $component.css("overflow-x");
			var overflowY = $component.css("overflow-y");		
			var hasOverflowX = overflowX == "scroll" || overflowX == "auto";
			var hasOverflowY = overflowY == "scroll" || overflowY == "auto";
			var hasFixedWidth = $component.width() < $this.width();
			var hasFixedHeight = $component.height() < $this.height();

			function init() {
				$t_fixed_table = $this.clone();
				$t_fixed_table.find("tbody").remove().end().css("width", ($this.width() + 1) + "px");
				$t_fixed = $("<div></div>");
				$t_fixed.attr("id", $this.attr("id") + "_fixedHeader")
				.css("width", ($component.width() - (hasFixedHeight && hasOverflowY ? getScrollBarWidth() : 0)) + "px")
				.css("position", "fixed")
				.css("display", "none")
				.insertBefore($this);
				if(hasFixedHeight && hasOverflowY) 
					$t_fixed.css("top", $("#" + $this.attr("id").replace("Table","")).offset().top - $(window).scrollTop());
				else 
					$t_fixed.css("top", "0");
				if(hasFixedWidth && hasOverflowX) 
					$t_fixed.css("overflow", "hidden");
				$t_fixed.append($t_fixed_table);			

				resizeFixed();
			}

			function resizeFixed() {
				$t_fixed.find("th").each(function(index) {
					$(this).css("width", $this.find("th").eq(index).outerWidth() + "px");
				});
			}

			function vScrollFixed() {			
				var offset = $(this).scrollTop(),
				tableOffsetTop = $this.offset().top,
				tableOffsetBottom = tableOffsetTop + $this.height() - $this.find("thead").height();

				if(offset < tableOffsetTop || offset > tableOffsetBottom)
					$t_fixed.hide();
				else if(offset >= tableOffsetTop && offset <= tableOffsetBottom && $t_fixed.is(":hidden"))
					$t_fixed.show();
			}

			function hScrollFixed() {	
				var offsetLeft = $(this).scrollLeft();
				var tableOffsetLeft = $this.offset().left;

				if(offsetLeft > 0) 
					$t_fixed.css("left", tableOffsetLeft-offsetLeft);
				else 
					$t_fixed.css("left", tableOffsetLeft);
			}

			function vScrollFixedOverflow() {
				var $filtersPanel = $("#" + $this.attr("id").replace("Table", "FiltersPanel"));

				var offset = $(this).scrollTop(),
				tableOffsetTop = $this.position().top + $this.find("thead").height() + ($filtersPanel.css("display") == "none" ? 0 : $filtersPanel.height()),
				tableOffsetBottom = tableOffsetTop + ($this.height() - $component.height());

				if(offset < tableOffsetTop || offset > tableOffsetBottom)
					$t_fixed.hide();
				else if(offset >= tableOffsetTop && offset <= tableOffsetBottom && $t_fixed.is(":hidden"))
					$t_fixed.show();
			}
			function hScrollFixedOverflow() {
				var offsetLeft = $(this).scrollLeft();
				var tableOffsetLeft = $this.offset().left;

				$t_fixed.scrollLeft(offsetLeft);
			}

			function getScrollBarWidth() {
				var inner = document.createElement('p');
				inner.style.width = "100%";
				inner.style.height = "200px";

				var outer = document.createElement('div');
				outer.style.position = "absolute";
				outer.style.top = "0px";
				outer.style.left = "0px";
				outer.style.visibility = "hidden";
				outer.style.width = "200px";
				outer.style.height = "150px";
				outer.style.overflow = "hidden";
				outer.appendChild (inner);

				document.body.appendChild (outer);
				var w1 = inner.offsetWidth;
				outer.style.overflow = 'scroll';
				var w2 = inner.offsetWidth;
				if (w1 == w2) w2 = outer.clientWidth;

				document.body.removeChild (outer);

				return (w1 - w2);
			}

			$(window).resize(resizeFixed);

			if(hasFixedWidth && hasOverflowX)
				$component.scroll(hScrollFixedOverflow);
			else
				$(window).scroll(hScrollFixed);

			if(hasFixedHeight && hasOverflowY) {
				$component.scroll(vScrollFixedOverflow);
				$(window).scroll(function() {
					$t_fixed.css("top", $component.offset().top - $(window).scrollTop());
				});			
			}
			else
				$(window).scroll(vScrollFixed);

			init();
		});
	};
})(jQuery);


var isMobile = {
		Android: function() {
			return navigator.userAgent.match(/Android/i);
		},
		BlackBerry: function() {
			return navigator.userAgent.match(/BlackBerry/i);
		},
		iOS: function() {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
		},
		Opera: function() {
			return navigator.userAgent.match(/Opera Mini/i);
		},
		Windows: function() {
			return navigator.userAgent.match(/IEMobile/i);
		},
		any: function() {
			return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
		}
};

