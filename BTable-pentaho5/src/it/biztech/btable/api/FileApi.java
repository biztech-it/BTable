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

import java.io.IOException;

import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;

import org.apache.commons.io.IOUtils;
import org.pentaho.platform.api.engine.IPluginResourceLoader;
import org.pentaho.platform.engine.core.system.PentahoSystem;

import com.sun.jersey.multipart.FormDataParam;

import it.biztech.btable.BTableDefinition;
import it.biztech.btable.util.Utils;

import pt.webdetails.cpf.repository.api.IBasicFile;
import pt.webdetails.cpf.utils.MimeTypes;


@Path( "BTable/api/file" )
public class FileApi {
	
	private class MethodParams {
		private static final String PATH = "path";
		private static final String BTABLE_DEFINITION = "btdef";
	}

	@POST
	@Path( "/save" )
	@Produces( MimeTypes.JSON )
	@Consumes( "multipart/form-data" )
	public String save( @FormDataParam( MethodParams.PATH ) @DefaultValue( "" ) String path,
                      	@FormDataParam( MethodParams.BTABLE_DEFINITION ) String btdef,
                      	@Context HttpServletResponse response ) throws Exception {
    
	    try {
	    	final BTableDefinition btableDefinition = new BTableDefinition();
	    	Object result = null;
	        result = btableDefinition.save( path, btdef );
	        return Utils.getJsonResult( true, result );
	    } catch ( Exception e ) {
	    	String result = e.getMessage();
	    	return Utils.getJsonResult( false, result );
	    }    
        
	}
	
	@GET
	@Path( "/read" )
	@Produces( "text/plain" )
	public void read( @QueryParam( MethodParams.PATH ) @DefaultValue( "" ) String path,
	                  @Context HttpServletResponse response ) throws IOException {
		try {
			IBasicFile file = Utils.getFile( path, null );
			
			if ( file == null ) {
				response.sendError( HttpServletResponse.SC_INTERNAL_SERVER_ERROR );
	        	return;
	        }
			
			IPluginResourceLoader resLoader = PentahoSystem.get( IPluginResourceLoader.class, null );
			String maxAge = resLoader.getPluginSetting( this.getClass(), "max-age" );
			
			String mimeType;
			try {
				final MimeTypes.FileType fileType = MimeTypes.FileType.valueOf( file.getExtension().toUpperCase() );
				mimeType = MimeTypes.getMimeType( fileType );
			} catch ( java.lang.IllegalArgumentException ex ) {
				mimeType = "";
			} catch ( EnumConstantNotPresentException ex ) {
				mimeType = "";
			}

			response.setHeader( "Content-Type", mimeType );
			response.setHeader( "content-disposition", "inline; filename=\"" + file.getName() + "\"" );

			if ( maxAge != null ) {
				response.setHeader( "Cache-Control", "max-age=" + maxAge );
			}

			byte[] contents = IOUtils.toByteArray( file.getContents() );

			IOUtils.write( contents, response.getOutputStream() );
			
			response.getOutputStream().flush();
	    } catch ( SecurityException e ) {
	    	response.sendError( HttpServletResponse.SC_FORBIDDEN );
	    }
	}
	
}
