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

package it.biztech.btable;

import it.biztech.btable.olap.OlapUtils;
import it.biztech.btable.util.Utils;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.fileupload.FileItem;
import org.apache.commons.fileupload.FileItemFactory;
import org.apache.commons.fileupload.FileUploadBase;
import org.apache.commons.fileupload.disk.DiskFileItemFactory;
import org.apache.commons.fileupload.servlet.ServletFileUpload;
import org.apache.commons.io.IOUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import org.pentaho.platform.api.engine.IParameterProvider;
import org.pentaho.platform.api.engine.IPluginResourceLoader;
import org.pentaho.platform.engine.core.system.PentahoSystem;

import pt.webdetails.cpf.PentahoPluginEnvironment;
import pt.webdetails.cpf.annotations.AccessLevel;
import pt.webdetails.cpf.annotations.Exposed;
import pt.webdetails.cpf.repository.api.IBasicFile;
import pt.webdetails.cpf.utils.MimeTypes;
import pt.webdetails.cpk.CpkContentGenerator;


public class BTableContentGenerator extends CpkContentGenerator {
    
	private static final long serialVersionUID = 1L;
	
	private static final Log logger = LogFactory.getLog( BTableContentGenerator.class );

	private static final String ENCODING = "UTF-8";
	
	public BTableContentGenerator() {
		super();
	}
	
	@Exposed(accessLevel = AccessLevel.PUBLIC)
	public void save(final OutputStream out) throws Exception {		
	    String path = null;
	    String btdef = null;
	    
	    if ( getRequest().getContentType().startsWith( "multipart/form-data" ) ) {
	    	FileItemFactory factory = new DiskFileItemFactory();
	    	ServletFileUpload upload = new ServletFileUpload( factory );
	    	List items = null;
	    	try {
	    		items = upload.parseRequest( getRequest() );
	    	} catch ( FileUploadBase.InvalidContentTypeException e ) {
	    		logger.debug( "BTable Save - content type not multipart/form-data" );
	    	}
	    	if ( items != null ) {
	    		for ( int i = 0; i < items.size(); i++ ) {
	    			FileItem fi = (FileItem) items.get( i );
	          
	    			if ( MethodParams.PATH.equals( fi.getFieldName() ) ) {
	    				path = fi.getString();
	    			}
	    			if ( MethodParams.BTABLE_DEFINITION.equals( fi.getFieldName() ) ) {
	    				btdef = fi.getString( ENCODING );
	    			}
	    		}
	    		
	    	    try {
	    	    	final BTableDefinition btableDefinition = new BTableDefinition();
	    	    	Object result = null;
	    	        result = btableDefinition.save( path, btdef );
	    	        Utils.buildJsonResult( getResponse().getOutputStream(), true, result );
	    	    } catch ( Exception e ) {
	    	    	String result = e.getMessage();
	    	    	Utils.buildJsonResult( getResponse().getOutputStream(), false, result );
	    	    }
	    	} else {
		    	logger.debug( "BTable Save - no item uploaded" );
	    	}
	    } else {
	    	logger.debug( "BTable Save - content type not multipart/form-data" );
	    }
	}

	@Exposed(accessLevel = AccessLevel.PUBLIC)
	public void open(final OutputStream out) throws IOException {
		IParameterProvider pathParams = getRequestParameters();
		
		String filePath = "/" + 
				pathParams.getStringParameter( MethodParams.SOLUTION, null ) + 
				"/" + pathParams.getStringParameter( MethodParams.PATH, null ) + 
				"/" + pathParams.getStringParameter( MethodParams.FILE, null );

		filePath = filePath.replaceAll("//+", "/");

		HttpServletResponse response = (HttpServletResponse) parameterProviders.get( MethodParams.PATH ).getParameter( "httpresponse" );

		String apiUrl = PentahoPluginEnvironment.getInstance().getUrlProvider().getPluginBaseUrl();
		String url = apiUrl + "render?btfile=" + filePath;

		if (response == null) {
			logger.error("response not found");
			return;
		}
		try {
			response.sendRedirect( url );
			response.getOutputStream().flush();
		} catch ( IOException e ) {
			logger.error("could not redirect", e);
		}
	}	
	
	@Exposed(accessLevel = AccessLevel.PUBLIC)
	public void read(final OutputStream out) throws IOException {
		final HttpServletResponse response = getResponse();
		
		try {
			String path = getRequestParameters().getStringParameter(MethodParams.PATH, null);
			
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

	@Exposed( accessLevel = AccessLevel.PUBLIC )
	public void olapUtils( final OutputStream out ) {
		OlapUtils olapUtils = new OlapUtils();
		Object result = null;
		
		try {
			String operation = getRequestParameters().getStringParameter( "operation", "-" );

			if ( operation.equals( "GetOlapCubes" ) ) {
				result = olapUtils.getOlapCubes();
			} else if ( operation.equals( "GetCubeStructure" ) ) {
				String catalog = getRequestParameters().getStringParameter( "catalog", null );
				String cube = getRequestParameters().getStringParameter( "cube", null );
				String jndi = getRequestParameters().getStringParameter( "jndi", null );
				result = olapUtils.getCubeStructure( catalog, cube, jndi );
			}
			
			Utils.buildJsonResult( out, result != null, result );
		} catch ( Exception ex ) {
			Utils.buildJsonResult( out, false, "Exception found: " + ex.getClass().getName() + " - " + ex.getMessage() );
		}
	}
	  
	
	private class MethodParams {
		public static final String SOLUTION = "solution";
		public static final String PATH = "path";
		public static final String FILE = "file";
		public static final String BTABLE_DEFINITION = "btdef";
	}

}
