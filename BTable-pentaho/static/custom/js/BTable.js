/********************************** Project namespace *******************************************/
var BTablePlugin = {};

(function(myself){

  myself.runEndpoint = function ( pluginId, endpoint, opts){

    if ( !pluginId && !endpoint){
      Dashboards.log('PluginId or endpointName not defined.');
      return false
    }

    var _opts = {
      success: function (){
        Dashboards.log( pluginId + ': ' + endpoint + ' ran successfully.')
      },
      error: function (){
        Dashboards.log( pluginId + ': error running ' + endpoint + '.')
      },
      params: {},
      systemParams: {},
      type: 'POST',
      dataType: 'json'
    }
    var opts = $.extend( {}, _opts, opts);
    var url = Dashboards.getWebAppPath() + '/content/' + pluginId + '/' + endpoint;

    function successHandler  (json){
      if ( json && json.result == false){
        opts.error.apply(this, arguments);
      } else {
        opts.success.apply( this, arguments );
      }
    }

    function errorHandler  (){
      opts.error.apply(this, arguments);
    }

    var ajaxOpts = {
      url: url,
      async: true,
      type: opts.type,
      dataType: opts.dataType,
      success: successHandler,
      error: errorHandler,
      data: {}
    }

    _.each( opts.params , function ( value , key){
      ajaxOpts.data['param' + key] = value;
    });
    _.each( opts.systemParams , function ( value , key){
      ajaxOpts.data[key] = value;
    });

    $.ajax(ajaxOpts)
  }

})(BTablePlugin);