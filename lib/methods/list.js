"use strict";

var debug = require( "debug" )( "restful-keystone" );
var _ = require( "lodash" );
var deepMerge = require( "deepmerge" );
var errors = require( "errors" );
var retrieve = require( "./retrieve" );
var utils = require( "../utils" );
var handleResult = utils.handleResult;
var getId = utils.getId;

module.exports = function( list,
                           config,
                           entry ){
  config = _.defaults( {
    name : list.path
  }, config );
  return {
    handle : function( req,
                       res,
                       next ){
      debug( "LIST", config.name );
      var id = getId( req );
      if( id ){
        return retrieve( list, config, entry ).handle( req, res, next );
      }
      var filter = req.query[ "filter" ] || req.body[ "filter" ];
      if( _.isString( filter ) ){
        try{
          filter = JSON.parse( filter );
        } catch( err ) {
          return next( new errors.Http400Error( {
            explanation : "Invalid JSON in query string parameter 'filter'"
          } ) );
        }
      }
      if( _.isFunction( config.filter ) ){
        config.filter = config.filter();
      }
      filter = deepMerge( config.filter || {}, filter || {} );

      // add default limit
      var limit = req.query["limit"] || req.body["limit"] || 10;

      // add sort support
      var sort = req.query["sort"] || req.body["sort"] || '';

      // add paginate support
      var page = req.query["page"] || req.body["page"] || null;
      if ( _.isString(page)) {
        try {
          page = JSON.parse(page);
        } catch (e) {
          return next(new errors.Http400Error({
            explanation: "Invalid JSON in query string parameter 'page' "
          }))
        }
      }

      if (page) {
        // do paginate query
        page = deepMerge({
          page: 1,
          perPage: 10
        }, page);
        debug('page:', page);
        list.paginate(page)
          .where(filter)
          .exec(function (err, results) {
            if (err) {
              next(err);
              return;
            }
            res.locals.body = results;
            res.locals.status = 200;
            next();
          });
      } else {
        // do normal query
        list.model.find( filter, config.show, config )
          .limit(limit)
          .sort(sort)
          .exec()
          .then( function( result ){
            result = handleResult( result || [], config );
            res.locals.body = result;
            res.locals.status = 200;
            next();
          } )
          .then( null, function( err ){
            next( err );
          } );
      }
    },
    verb   : "get",
    url    : entry
  };
};
