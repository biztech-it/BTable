/*
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
 */

package it.biztech.btable.api;

import it.biztech.btable.olap.OlapUtils;
import it.biztech.btable.util.Utils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import java.io.IOException;

import net.sf.json.JSONObject;

import org.json.JSONException;


@Path( "BTable/api/olap" )
public class OlapApi {

  @GET
  @Path( "/getCubes" )
  @Produces( "text/javascript" )
  public void getCubes( @QueryParam( MethodParams.CATALOG ) String catalog, 
		  				@Context HttpServletRequest request,
		  				@Context HttpServletResponse response ) throws IOException, JSONException {
    OlapUtils olapUtils = new OlapUtils();
    JSONObject result = olapUtils.getOlapCubes();
    Utils.buildJsonResult( response.getOutputStream(), result != null, result );
  }

  @GET
  @Path( "/getCubeStructure" )
  @Produces( "text/javascript" )
  public void getCubeStructure( @QueryParam( MethodParams.CATALOG ) String catalog,
		  						@QueryParam( MethodParams.CUBE ) String cube, 
		  						@QueryParam( MethodParams.JNDI ) String jndi, 
		  						@Context HttpServletResponse response ) throws IOException, JSONException {
    OlapUtils olapUtils = new OlapUtils();
    JSONObject result = olapUtils.getCubeStructure( catalog, cube, jndi );
    Utils.buildJsonResult( response.getOutputStream(), result != null, result );
  }
  
  private class MethodParams {
    public static final String CATALOG = "catalog";
    public static final String CUBE = "cube";
    public static final String JNDI = "jndi";
  }
  
}
