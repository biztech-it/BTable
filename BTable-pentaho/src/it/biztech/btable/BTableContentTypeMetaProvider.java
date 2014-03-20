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

import org.pentaho.platform.api.engine.IFileInfo;
import org.pentaho.platform.api.engine.ISolutionFile;
import org.pentaho.platform.api.engine.SolutionFileMetaAdapter;
import org.pentaho.platform.engine.core.solution.FileInfo;

import java.io.InputStream;


public class BTableContentTypeMetaProvider extends SolutionFileMetaAdapter {

	public BTableContentTypeMetaProvider() {}

	public IFileInfo getFileInfo( ISolutionFile solutionFile, InputStream in ) {
		//String solution = solutionFile.getSolution();
	    //String path = solutionFile.getFullPath();
	    String fileName = solutionFile.getFileName();
	    
	    String title = fileName;
	    if ( title != null && title.endsWith( BTableConstants.FILE_EXTENSION ) ) {
	    	title = title.substring( 0, title.indexOf( BTableConstants.FILE_EXTENSION ) );
	    }
	      
	    IFileInfo info = new FileInfo();
	    info.setAuthor( "" );
	    info.setDescription( "BTable Analysis" );
	    //info.setDisplayType( "report" );
	    //info.setIcon( "/static/custom/img/btableFileIcon.png" );
	    info.setTitle( title );
	    
	    return info;
	}	
}