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

package it.biztech.btable.util;

import it.biztech.btable.BTableConstants;

import java.io.OutputStream;
import java.io.PrintWriter;

import net.sf.json.JSONObject;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;

import pt.webdetails.cpf.PentahoPluginEnvironment;
import pt.webdetails.cpf.repository.api.FileAccess;
import pt.webdetails.cpf.repository.api.IBasicFile;
import pt.webdetails.cpf.repository.api.IContentAccessFactory;
import pt.webdetails.cpf.repository.api.IRWAccess;


public class Utils {

  	public static IBasicFile getFile( String filePath, String basePath ) {
  		if( StringUtils.isEmpty( filePath ) ) {
			return null;
		}
		
		IContentAccessFactory factory = PentahoPluginEnvironment.getInstance().getContentAccessFactory();
		String res = StringUtils.strip( filePath.toLowerCase(), "/" );
		
		if( res.startsWith( BTableConstants.SYSTEM_DIR + "/" ) ) {
			res = StringUtils.strip( res, BTableConstants.SYSTEM_DIR + "/" );
			if( res.startsWith( BTableConstants.PLUGIN_SYSTEM_DIR.toLowerCase() + "/" ) ) {
				filePath = filePath.replaceFirst( BTableConstants.SYSTEM_DIR + "/" + BTableConstants.PLUGIN_SYSTEM_DIR + "/", "" );
				return factory.getPluginSystemReader( basePath ).fetchFile( filePath );
			} else {
				String pluginId = res.substring( 0, filePath.indexOf( "/" ) );
				filePath = filePath.replaceFirst( BTableConstants.SYSTEM_DIR + "/" + pluginId + "/", "" );
				return factory.getOtherPluginSystemReader( pluginId, basePath ).fetchFile( filePath );
			}
		} else if( res.startsWith( BTableConstants.PLUGIN_REPOSITORY_DIR.toLowerCase() + "/" ) ) {
			filePath = filePath.replaceFirst( BTableConstants.PLUGIN_REPOSITORY_DIR + "/", "" );
			return factory.getPluginRepositoryReader( basePath ).fetchFile( filePath );
		} else {
			if ( factory.getPluginSystemReader( basePath ).fileExists( filePath ) ) {
				return factory.getPluginSystemReader( basePath ).fetchFile( filePath );
			} else if ( factory.getUserContentAccess( basePath ).fileExists( filePath ) ) {
				return factory.getUserContentAccess( basePath ).fetchFile( filePath );
			}
		}
		
		return null;
  	}

	public static IRWAccess getSystemRWAccess( String pluginId, String basePath ) {
		IContentAccessFactory factory = PentahoPluginEnvironment.getInstance().getContentAccessFactory();
		
		if( StringUtils.isEmpty( pluginId ) )               {
			return factory.getPluginSystemWriter( basePath );
		} else {
			return factory.getOtherPluginSystemWriter( pluginId, basePath );
		}
	}
  	
	public static IRWAccess getSystemOrUserRWAccess( String filePath ) {
		IRWAccess rwAccess = null;
		
		if( filePath.startsWith( "/" + BTableConstants.SYSTEM_DIR + "/" ) && filePath.endsWith( BTableConstants.FILE_EXTENSION ) ) {
			rwAccess = getSystemRWAccess( filePath.split( "/" )[2], null );
		} else if( PentahoPluginEnvironment.getInstance().getUserContentAccess( "/" ).fileExists( filePath ) ) {
			if( PentahoPluginEnvironment.getInstance().getUserContentAccess( "/" ).hasAccess( filePath, FileAccess.EXECUTE ) ) {
				if( PentahoPluginEnvironment.getInstance().getUserContentAccess( "/" ).hasAccess( filePath, FileAccess.WRITE ) ) {
					rwAccess = PentahoPluginEnvironment.getInstance().getUserContentAccess( "/" );
				}
			} else {
				return null;
			}
		} else if( PentahoPluginEnvironment.getInstance().getUserContentAccess("/").hasAccess( "/" + FilenameUtils.getPath( filePath ), FileAccess.EXECUTE ) ) {
			rwAccess = PentahoPluginEnvironment.getInstance().getUserContentAccess("/");
		}
		
		return rwAccess;
	}
   
	public static String getJsonResult( boolean success, Object result ) {
		final JSONObject jsonResult = new JSONObject();
	    jsonResult.put( "status", Boolean.toString( success ) );
	    if( result != null ) {
	    	jsonResult.put( "result", result );
	    }
	    return jsonResult.toString( 2 );
	}   

	public static void buildJsonResult( final OutputStream out, final Boolean success, final Object result ) {
		final JSONObject jsonResult = new JSONObject();
		jsonResult.put( "status", Boolean.toString( success ) );
		if( result != null ) {
			jsonResult.put( "result", result );
		}
	    PrintWriter pw = null;
	    try {
	    	pw = new PrintWriter( out );
		    pw.print( jsonResult.toString( 2 ) );
		    pw.flush();
	    } finally{
		    IOUtils.closeQuietly(pw);
		}
	}	
	
}
