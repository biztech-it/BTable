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

package it.biztech.btable.olap;

import java.util.HashMap;
import java.util.List;
import javax.sql.DataSource;

import mondrian.olap.Connection;
import mondrian.olap.Dimension;
import mondrian.olap.DriverManager;
import mondrian.olap.Hierarchy;
import mondrian.olap.Level;
import mondrian.olap.MondrianDef.CalculatedMember;
import mondrian.olap.MondrianDef.Cube;
import mondrian.olap.MondrianDef.Measure;
import mondrian.olap.MondrianDef.Schema;
import mondrian.olap.Query;
import mondrian.olap.Role;
import mondrian.olap.Util;
import mondrian.rolap.RolapConnectionProperties;
import mondrian.rolap.RolapMember;
import mondrian.rolap.RolapMemberBase;
import mondrian.rolap.RolapResult;
import mondrian.rolap.RolapSchema;

import net.sf.json.JSONArray;
import net.sf.json.JSONObject;

import org.apache.commons.lang.StringUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import org.json.JSONException;

import org.pentaho.platform.api.data.IDBDatasourceService;
import org.pentaho.platform.api.engine.ICacheManager;
import org.pentaho.platform.api.engine.IConnectionUserRoleMapper;
import org.pentaho.platform.api.engine.IPentahoSession;
import org.pentaho.platform.api.engine.PentahoAccessControlException;
import org.pentaho.platform.engine.core.system.PentahoSessionHolder;
import org.pentaho.platform.engine.core.system.PentahoSystem;
import org.pentaho.platform.plugin.action.mondrian.catalog.IMondrianCatalogService;
import org.pentaho.platform.plugin.action.mondrian.catalog.MondrianCatalog;
import org.pentaho.platform.plugin.action.mondrian.catalog.MondrianCatalogHelper;
import org.pentaho.platform.plugin.action.mondrian.catalog.MondrianCube;
import org.pentaho.platform.plugin.services.connections.mondrian.MDXConnection;
import org.pentaho.platform.util.messages.LocaleHelper;


@SuppressWarnings("deprecation")
public class OlapUtils {

	private static Log logger = LogFactory.getLog(OlapUtils.class);
	
	private IPentahoSession userSession;
	private ICacheManager cacheManager;
	boolean cachingAvailable;
	private static final String MONDRIAN_CATALOGS = "CDFDD_DATASOURCES_REPOSITORY_DOCUMENT";
	private final IMondrianCatalogService mondrianCatalogService = MondrianCatalogHelper.getInstance();
	Connection nativeConnection = null;

	public OlapUtils() {
		this.userSession = PentahoSessionHolder.getSession();
		cacheManager = PentahoSystem.getCacheManager(userSession);
		cachingAvailable = cacheManager != null && cacheManager.cacheEnabled();	
	}
	
	public JSONObject getOlapCubes() throws JSONException {
		logger.debug("Returning Olap cubes");

		JSONObject result = new JSONObject();
		JSONArray catalogsArray = new JSONArray();

		List<MondrianCatalog> catalogList = getMondrianCatalogs();
		for (MondrianCatalog catalog : catalogList) {
			
			Connection connection = getMdxConnection(catalog.getDefinition(), catalog.getJndi());
			if (connection == null) {
				logger.error("Failed to get valid connection");
				return null;
			}
			Role role = connection.getRole();

			JSONArray cubesArray = new JSONArray();
			
			List<MondrianCube> cubeList = catalog.getSchema().getCubes();
			for (MondrianCube cube : cubeList) {
				
				String query = "select {Measures.Children} ON Rows, {} ON Columns from [" + cube.getId() + "]";
				Query mdxQuery = null;
				try {
					mdxQuery = connection.parseQuery(query);
				} catch(Exception e) {
				}
				
				if(mdxQuery != null) {
					mondrian.olap.Cube olapCube = mdxQuery.getCube();
					if(role.canAccess(olapCube)) {
						JSONObject cubeJson = new JSONObject();
						cubeJson.put("id", cube.getId());
						cubeJson.put("name", cube.getName());
						cubeJson.put("caption", olapCube.getCaption());
						cubeJson.put("description", olapCube.getDescription());
						cubesArray.add(cubeJson);					
					}
				}
				
			}
			
			JSONObject catalogJson = new JSONObject();
			catalogJson.put("name", catalog.getName());
			catalogJson.put("schema", catalog.getDefinition());
			catalogJson.put("jndi", catalog.getJndi());
			//catalogJson.put("cubes", JSONArray.fromObject(catalog.getSchema().getCubes()));
			catalogJson.put("cubes", cubesArray);
			catalogsArray.add(catalogJson);
			
		}

		logger.debug("Cubes found: " + catalogsArray.toString(2));

		result.put("catalogs", catalogsArray);
		
		return result;
	}

	public JSONObject getCubeStructure(String catalog, String cube, String jndi) throws JSONException {
		logger.debug("Returning Olap structure for cube " + cube);
		
		JSONObject result = new JSONObject();

		Connection connection = jndi != null ? getMdxConnection(catalog, jndi) : getMdxConnection(catalog);

		if (connection == null) {
			logger.error("Failed to get valid connection");
			return null;
		}

		JSONArray dimensionsArray = getDimensions(connection, cube);
		System.out.println(dimensionsArray.toString(2));
		result.put("dimensions", dimensionsArray);

		JSONArray measuresArray = getMeasures(connection, cube);
		System.out.println(measuresArray.toString(2));
		result.put("measures", measuresArray);

		return result;
	}
	
	private JSONArray getDimensions(Connection connection, String cube) throws JSONException {
		String query = "select {} ON Rows, {} ON Columns from [" + cube + "]";
		Query mdxQuery = connection.parseQuery(query);

		Role role = connection.getRole();
		
		JSONArray dimensionsArray = new JSONArray();
		Dimension[] dimensions = mdxQuery.getCube().getDimensions();

		for (Dimension dimension : dimensions) {
			if (dimension.isMeasures() || !role.canAccess(dimension)) {
				continue;
			}
			
			JSONObject jsonDimension = new JSONObject();
			jsonDimension.put("name", dimension.getName());
			jsonDimension.put("caption", dimension.getCaption().isEmpty() ? dimension.getName() : dimension.getCaption());
			jsonDimension.put("description", dimension.getDescription());
			jsonDimension.put("type", dimension.getDimensionType().name());
			
			// Hierarchies
			JSONArray hierarchiesArray = new JSONArray();
			Hierarchy[] hierarchies = dimension.getHierarchies();
			
			for (Hierarchy hierarchy : hierarchies) {
				if (role.canAccess(hierarchy)) {
					JSONObject jsonHierarchy = new JSONObject();
					jsonHierarchy.put("type", "hierarchy");
					jsonHierarchy.put("name", hierarchy.getName());
					jsonHierarchy.put("caption", hierarchy.getCaption().isEmpty() ? hierarchy.getName() : hierarchy.getCaption());
					jsonHierarchy.put("description", hierarchy.getDescription());
					jsonHierarchy.put("qualifiedName", hierarchy.getQualifiedName().substring(11, hierarchy.getQualifiedName().length() - 1));
					jsonHierarchy.put("defaultMember", hierarchy.getAllMember().getName());
					jsonHierarchy.put("defaultMemberCaption", hierarchy.getAllMember().getCaption().isEmpty() ? hierarchy.getAllMember().getName() : hierarchy.getAllMember().getCaption());
					jsonHierarchy.put("defaultMemberQualifiedName", hierarchy.getAllMember().getQualifiedName().substring(8, hierarchy.getAllMember().getQualifiedName().length() - 1));
					
					// Levels
					JSONArray levelsArray = new JSONArray();
					Level[] levels = hierarchy.getLevels();
					
					for (Level level : levels) {
						JSONObject jsonLevel = new JSONObject();
						if (!level.isAll()) {
							jsonLevel.put("type", "level");
							jsonLevel.put("depth", level.getDepth());
							jsonLevel.put("name", level.getName());
							jsonLevel.put("caption", level.getCaption().isEmpty() ? level.getName() : level.getCaption());
							jsonLevel.put("description", level.getDescription());
							jsonLevel.put("qualifiedName", level.getQualifiedName().substring(7, level.getQualifiedName().length() - 1));
							
							levelsArray.add(jsonLevel);
						}
					}
					
					jsonHierarchy.put("levels", levelsArray);
					hierarchiesArray.add(jsonHierarchy);
				}
			}
			
			jsonDimension.put("hierarchies", hierarchiesArray);
			dimensionsArray.add(jsonDimension);
		}

		return dimensionsArray;
	}

	private JSONArray getMeasures(Connection connection, String cube) throws JSONException {
		String query = "select {Measures.Children} ON Rows, {} ON Columns from [" + cube + "]";
		Query mdxQuery = connection.parseQuery(query);
		
		Role role = connection.getRole();
		
		RolapResult result = (RolapResult) connection.execute(mdxQuery);
		List<RolapMember> rolapMembers = result.getCube().getMeasuresMembers();

		HashMap<String,JSONObject> defs = new HashMap<String,JSONObject>();
		
	    RolapSchema rolapSchema = result.getCube().getSchema();
	    Schema schemaDef = rolapSchema.getXMLSchema();
	    
	    Cube[] mdCubes = schemaDef.cubes;
	    for (Cube mdCube : mdCubes) {
	    	if(mdCube.name.equals(cube)) {
	    	
		    	Measure[] mdMeasures = mdCube.measures;
		    	for (Measure mdMeasure : mdMeasures) {
		    		JSONObject jsonMdMeasure = new JSONObject();
		    		jsonMdMeasure.put("datatype", mdMeasure.datatype);
		    		jsonMdMeasure.put("formatString", mdMeasure.formatString);
		    		
		    		defs.put(mdMeasure.name, jsonMdMeasure);
		    	}
		    	
		    	CalculatedMember[] mdCalculatedMembers = mdCube.calculatedMembers;
		    	for (CalculatedMember mdCalculatedMember : mdCalculatedMembers) {
		    		JSONObject jsonMdCalculatedMember = new JSONObject();
		    		jsonMdCalculatedMember.put("formatString", mdCalculatedMember.getFormatString());
		    		jsonMdCalculatedMember.put("formula", mdCalculatedMember.getFormula());
		    		
		    		defs.put(mdCalculatedMember.name, jsonMdCalculatedMember);	    		
		    	}
		    	
	    	}	    	
	    }
		
		JSONArray measuresArray = new JSONArray();

		for (RolapMember measure : rolapMembers) {
			if (role.canAccess(measure) && measure.isVisible()) {
				String name = ((RolapMemberBase) measure).getName();
				JSONObject jsonMeasure = new JSONObject();
				jsonMeasure.put("type", "measure");
				jsonMeasure.put("name", name);
				jsonMeasure.put("caption", ((RolapMemberBase) measure).getCaption().isEmpty() ? name : ((RolapMemberBase) measure).getCaption());
				jsonMeasure.put("description", ((RolapMemberBase) measure).getDescription());
				jsonMeasure.put("qualifiedName", measure.getQualifiedName().substring(8, measure.getQualifiedName().length() - 1));
				jsonMeasure.put("memberType", measure.getMemberType().toString());
				jsonMeasure.put("formatString", defs.containsKey(name) ? defs.get(name).get("formatString") : "#,###");
	
				measuresArray.add(jsonMeasure);
			}
		}

		return measuresArray;
	}
	
	private Connection getMdxConnection(String catalog) {
		if (catalog != null && catalog.startsWith("/")) {
			catalog = StringUtils.substring(catalog, 1);
		}

		MondrianCatalog selectedCatalog = mondrianCatalogService.getCatalog(catalog, userSession);
		if (selectedCatalog == null) {
			logger.error("Received catalog '" + catalog + "' doesn't appear to be valid");
			return null;
		}
		selectedCatalog.getDataSourceInfo();
		logger.info("Found catalog " + selectedCatalog.toString());

		return getMdxConnection(selectedCatalog.getDefinition(), selectedCatalog.getJndi());		
	}

	private Connection getMdxConnection(String catalog, String jndi) {
		String connectStr = "Provider=mondrian; DataSource=" + jndi + "; Catalog=" + catalog 
			+ "; DynamicSchemaProcessor=mondrian.i18n.LocalizingDynamicSchemaProcessor; Locale=" + LocaleHelper.getLocale().toString()
			+ "; Role='" + getRoles(catalog) + "'";

		return getMdxConnectionFromConnectionString(connectStr);
	}

	private Connection getMdxConnectionFromConnectionString(String connectStr) {
		Util.PropertyList properties = Util.parseConnectString(connectStr);
		try {
			String dataSourceName = properties.get(RolapConnectionProperties.DataSource.name());

			if (dataSourceName != null) {
				IDBDatasourceService datasourceService = PentahoSystem.getObjectFactory().get(IDBDatasourceService.class, null);
				DataSource dataSourceImpl = datasourceService.getDataSource(dataSourceName);
				if (dataSourceImpl != null) {
					properties.remove(RolapConnectionProperties.DataSource.name());
					nativeConnection = DriverManager.getConnection(properties, null, dataSourceImpl);
				} else {
					nativeConnection = DriverManager.getConnection(properties, null);
				}
			} else {
				nativeConnection = DriverManager.getConnection(properties, null);
			}

			if (nativeConnection == null) {
				logger.error("Invalid connection: " + connectStr);
			}
		} catch (Throwable t) {
			logger.error("Invalid connection: " + connectStr + " - " + t.toString());
		}

		return nativeConnection;
	}
	
	private List<MondrianCatalog> getMondrianCatalogs() {
		List<MondrianCatalog> catalogs = null;

		if (cachingAvailable
				&& (catalogs = (List<MondrianCatalog>) cacheManager.getFromSessionCache(
						userSession, MONDRIAN_CATALOGS)) != null) {
			logger.debug("Datasource document found in cache");
			return catalogs;
		} else {
			catalogs = mondrianCatalogService.listCatalogs(userSession, true);
			cacheManager.putInSessionCache(userSession, MONDRIAN_CATALOGS, catalogs);
		}

		return catalogs;
	}
	
	public String getRoles(String catalog) {
		if (PentahoSystem.getObjectFactory().objectDefined(MDXConnection.MDX_CONNECTION_MAPPER_KEY)) {
			final IConnectionUserRoleMapper mondrianUserRoleMapper =
					PentahoSystem.get(IConnectionUserRoleMapper.class, MDXConnection.MDX_CONNECTION_MAPPER_KEY, null);
			try {
				final String[] validMondrianRolesForUser = 
					mondrianUserRoleMapper.mapConnectionRoles(PentahoSessionHolder.getSession(), catalog.replaceAll("mondrian:/", ""));

				if ((validMondrianRolesForUser != null) && (validMondrianRolesForUser.length > 0)) {
					final StringBuffer buff = new StringBuffer();
					for (int i = 0; i < validMondrianRolesForUser.length; i++) {
						final String aRole = validMondrianRolesForUser[i];
						// According to http://mondrian.pentaho.org/documentation/configuration.php
						// double-comma escapes a comma
						if (i > 0) {
							buff.append(",");
						}
						buff.append(aRole.replaceAll(",", ",,"));
					}
					logger.debug("Assembled role: " + buff.toString() + " for catalog: " + catalog);
					return buff.toString();
				}

			} catch(PentahoAccessControlException e) {
				logger.error("User has no rights to the catalog: " + catalog);
			}
		}
		
		return "";
	}
	
}
