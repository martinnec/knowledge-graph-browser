const express = require('express');
const request = require('request');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

app.get('/', function (req, res) {
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Knowledge graph browser</title>
<link rel="stylesheet" href="styles/main.css">
</head>
<body>
<h1>Knowledge graph viewer</h1>
<a href="http://localhost:3000/configurations?resourceiri=http://szrcr.cz/odrpp/zdroj/agenda/A1081&configurl=https://raw.githubusercontent.com/martinnec/kgbrowser/master/views/agenda.ttl&configiri=https://martin.necasky.solid.community/profile/kgbrowser/configuration/agenda">sample</a>
</body>
</html>`);
})

app.get('/view-sets', function (req, res)  {

  const configIRI = req.query.config ;
  const resourceIRI = req.query.resource ;
  
  const configStore = $rdf.graph();

  const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
  const VOID = $rdf.Namespace("http://rdfs.org/ns/void#");
  const BROWSER = $rdf.Namespace("https://linked.opendata.cz/ontology/knowledge-graph-browser/");
  const RS = $rdf.Namespace("http://www.w3.org/2005/sparql-results#");
  
  const requestOptions = {
    url: configIRI,
    headers: {
      'Accept': 'text/turtle'
    }
  };
  
  request(requestOptions, function (error, response, body) {   
    try {
      $rdf.parse(body, configStore, configIRI, "text/turtle");
      const config = $rdf.sym(configIRI);
      var viewSets = configStore.each(config, BROWSER("hasViewSet"), undefined);
      var output = [];
      
      buildViewSets(viewSets, 0);
      
      function buildViewSets(viewSets, i)  {
        console.log("viewSets: " + viewSets);
        if(viewSets.length == i) {
          console.log(output);
          res.contentType('application/json');
          res.send(JSON.stringify(output));
        } else {
          const viewSet = viewSets[i];
          console.log("viewSet: " + viewSet); 
          const viewSetIRI = viewSet.value ;
          
          const viewSetRequestOptions = {
            url: viewSetIRI,
            headers: {
              'Accept': 'text/turtle'
            }
          };
          const viewSetStore = $rdf.graph();
          request(viewSetRequestOptions, function (errorVS, responseVS, bodyVS) {
            try {
              $rdf.parse(bodyVS, viewSetStore, viewSetIRI, "text/turtle");
              const viewSet = $rdf.sym(viewSetIRI);
              const condition = viewSetStore.any(viewSet, BROWSER("hasCondition"), undefined).value;
              const datasetIRI = viewSetStore.any(viewSet, BROWSER("hasDataset"), undefined).value;
              const datasetRequestOptions = {
                url: datasetIRI,
                headers: {
                  'Accept': 'text/turtle'
                }
              };
              const datasetStore = $rdf.graph();
              console.log("datasetIRI: " + datasetIRI);
              request(datasetRequestOptions, function (errorDS, responseDS, bodyDS) {
                try {
                  $rdf.parse(bodyDS, datasetStore, datasetIRI, "text/turtle");
                  const dataset = $rdf.sym(datasetIRI);
                  const endpoint = datasetStore.any(dataset, VOID("sparqlEndpoint"), undefined).value;
                  const groundedCondition = condition.replace('ASK {', 'ASK { VALUES ?node {<' + resourceIRI + '>}');
                  const groundedConditionQueryURL = endpoint + '?query=' + encodeURI(groundedCondition) + '&format=text%2Fplain'; 
                  console.log("groundedConditionQueryURL: " + groundedConditionQueryURL);
                  request(groundedConditionQueryURL, function (conditionerror, conditionresponse, conditionbody) {
                    try{
                      if(conditionerror) {
                        console.log("Oops, something happened and couldn't fetch data: " + conditionerror);
                        res.send("Oops, something happened and couldn't fetch data");
                      } else {
                        console.log("ASK result of " + viewSetIRI +" for " + resourceIRI + ": " + conditionbody);
                        if(conditionbody.includes('true')) {
                          output.push(viewSetIRI);
                        }
                        buildViewSets(viewSets, i+1);
                      }
                    } catch (conditionerr) {
                      console.log(conditionerr);
                    }                  
                  });             
                } catch (errVS) {
                  console.log(errVS);
                }
              });
            } catch (errVS) {
              console.log(errVS);
            }                                                                              
          });
        }
      }
      
    } catch (err) {
      console.log(err);
    }    
  });  
                                    
});

app.get('/expand', function (req, res)  {

  const viewIRI = req.query.view ;
  const resourceIRI = req.query.resource ;

});

app.get('/preview', function (req, res)  {

  const viewIRI = req.query.view ;
  const resourceIRI = req.query.resource ;

});

app.get('/info', function (req, res)  {

  const viewIRI = req.query.view ;
  const resourceIRI = req.query.resource ;

});

/*app.get('/views', function (req, res)  {

  const resourceiri = req.query.resourceiri ;
  const configiri = req.query.configiri ;
  const configurl = req.query.configurl ;
  
  const configStore = $rdf.graph();

  const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
  const VIEW = $rdf.Namespace("https://linked.opendata.cz/ontology/view#");
  const RS = $rdf.Namespace("http://www.w3.org/2005/sparql-results#");

  var output = "";
  
  request(configurl, function (error, response, body) {   
    try {
      $rdf.parse(body, configStore, configurl, "text/turtle");
      
      const config = $rdf.sym(configiri);
      const configendpointurl = configStore.any(config, VIEW('endpointurl'), undefined);
      const configtitle = configStore.any(config, DCT('title'), undefined);
      const configconditionLiteral = configStore.any(config, VIEW('condition'), undefined);
      const configcondition = configconditionLiteral.value.replace('ASK {', 'ASK { VALUES ?node {<' + resourceiri + '>}');
      const configqueryurl = configendpointurl + '?query=' + encodeURI(configcondition) + '&format=text%2Fplain'; 

      const views = configStore.each(config, VIEW('hasView'), undefined);
      
      var output = "";

      request(configqueryurl, function (configerror, configresponse, configbody) {
        if(configerror) {
          console.log("Oops, something happened and couldn't fetch data: " + configerror);
          res.send("Oops, something happened and couldn't fetch data");
        } else {
          if(configbody.includes('true')) {
            listViews(views);
          }
        }
      });
      
      function listViews(views) {
        if(views.length==0) {
          output = "<ul>" + output + "</ul>";
          res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Knowledge graph browser</title>
<link rel="stylesheet" href="styles/main.css">
</head>
<body>
<h1>Available views for ${resourceiri} based on configuration ${configiri}</h1>
${output}  
</body>
</html>`);
        } else {
          const view = views.pop();
          const viewtitle = configStore.any(view, DCT('title'), undefined); 
          output += "<li><a href=\"/expand?resourceiri=" + resourceiri + "&configurl=" + configurl + "&viewiri=" + view.value + "\">" + viewtitle + "</a></li>";
          listViews(views);
        }
      }      
    } catch (err) {
      console.log(err);
    }    
  });  
                                    
})

app.get('/expand', function (req, res) {
  const resourceiri = req.query.resourceiri ;
  const viewiri = req.query.viewiri ;
  const configurl = req.query.configurl ;

  const configStore = $rdf.graph();

  const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
  const VIEW = $rdf.Namespace("https://linked.opendata.cz/ontology/view#");
  
  var title = "";
  
  request(configurl, function (error, response, body) {   
    try {
        $rdf.parse(body, configStore, configurl, "text/turtle");
        const view = $rdf.sym(viewiri);
        var endpointurl = configStore.any(view, VIEW('endpointurl'), undefined);
        title = configStore.any(view, DCT('title'));
        const expansionLiteral = configStore.any(view, VIEW('expansion'));
        const expansion = expansionLiteral.value.replace('WHERE {', 'WHERE { VALUES ?node {<' + resourceiri + '>}')
        const url = endpointurl + '?query=' + encodeURI(expansion) + '&format=text%2Fturtle';

        const store = $rdf.graph();  
        const fetcher = new $rdf.Fetcher(store);
        fetcher.nowOrWhenFetched(url, function(ok, body2, xhr) {
          if (!ok) {
            console.log("Oops, something happened and couldn't fetch data");
            res.send("Oops, something happened and couldn't fetch data");
          } else {
            var resource = $rdf.sym(resourceiri);
            var statements = store.statementsMatching(resource, undefined, undefined);
            var output = "<table>";
            for (var i=0; i<statements.length;i++)  {
              statement = statements[i];
              output += "<tr><td><a href=\"/preview?resourceiri=" + statement.subject.uri + "&configurl=" + configurl + "&viewiri=" + view.value + "\">" + decodeURI(JSON.parse('"' + statement.subject.uri + '"')) + "</a></td><td>" + decodeURI(JSON.parse('"' + statement.predicate.uri + '"')) + "</td>";
              if (statement.object.termType == 'Literal') {
                output += "<td>" + statement.object.value  + "</td></tr>";        
              } else  {
                output += "<td>" + decodeURI(JSON.parse('"' + statement.object.uri + '"'))  + "</td></tr>";        
              }
            }
            var statements = store.statementsMatching(undefined, undefined, resource);
            for (var i=0; i<statements.length;i++)  {
              statement = statements[i];
              output += "<tr><td>" + decodeURI(JSON.parse('"' + statement.subject.uri + '"')) + "</td><td>" + decodeURI(JSON.parse('"' + statement.predicate.uri + '"')) + "</td>";
              if (statement.object.termType == 'Literal') {
                output += "<td>" + statement.object.value  + "</td></tr>";        
              } else  {
                output += "<td><a href=\"/preview?resourceiri=" + statement.object.uri + "&configurl=" + configurl + "&viewiri=" + view.value + "\">" + decodeURI(JSON.parse('"' + statement.object.uri + '"')) + "</a></td></tr>";        
              }
            }
            output += "</table>";
            res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Knowledge graph browser</title>
<link rel="stylesheet" href="styles/main.css">
</head>
<body>
<h1>Expansion of ${resourceiri} via ${title}</h1>
${output}  
</body>
</html>`);      
            
          }    
        });
    } catch (err) {
        console.log(err)
    }    
  });
})

app.get('/preview', function (req, res) {
  const resourceiri = req.query.resourceiri ;
  const viewiri = req.query.viewiri ;
  const configurl = req.query.configurl ;

  const configStore = $rdf.graph();

  const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
  const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
  const VIEW = $rdf.Namespace("https://linked.opendata.cz/ontology/view#");
  
  var viewtitle = "";
  
  request(configurl, function (error, response, body) {   
    try {
        $rdf.parse(body, configStore, configurl, "text/turtle");
        const view = $rdf.sym(viewiri);
        var endpointurl = configStore.any(view, VIEW('endpointurl'), undefined);
        viewtitle = configStore.any(view, DCT('title'));
        const previewLiteral = configStore.any(view, VIEW('preview'));
        const preview = previewLiteral.value.replace('WHERE {', 'WHERE { VALUES ?node {<' + resourceiri + '>}')
        const url = endpointurl + '?query=' + encodeURIComponent(preview) + '&format=text%2Fturtle';

        const store = $rdf.graph();  
        const fetcher = new $rdf.Fetcher(store);
        fetcher.nowOrWhenFetched(url, function(ok, body2, xhr) {
          if (!ok) {
            console.log("Oops, something happened and couldn't fetch data");
            res.send("Oops, something happened and couldn't fetch data");
          } else {
            var resource = $rdf.sym(resourceiri);
            var title = store.any(resource, RDFS("label"));
            var typeiri =  store.any(resource, RDF("type")).uri;
            var type = $rdf.sym(decodeURI(JSON.parse('"' + typeiri + '"')))
            var statements = configStore.statementsMatching(type, undefined, undefined);
            var backgroundColor = configStore.any(type, VIEW("background-color"));
            var borderColor = configStore.any(type, VIEW("border-color"));
            var color = configStore.any(type, VIEW("color"));
            var shape = configStore.any(type, VIEW("shape"));
            var emoji = configStore.any(type, VIEW("emoji"));
             
            res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Knowledge graph browser</title>
<link rel="stylesheet" href="styles/main.css">
</head>
<body>
<h1>Preview of ${resourceiri} via ${viewtitle}</h2>
<p id="${shape.value}">
<span>${emoji.value}</span><br>
<span>${title}</span>
</p>
<style contenteditable="">
  #rectangle {
    width: 300px;
    height: 100px;
    background-color: ${backgroundColor.value};
    border-color: ${borderColor.value};
    border-width: 3px;
    padding: 3px;
    color: ${color.value};
    text-align: center;
    vertical-align: middle;
  }
</style>  
</body>
</html>`);      
            
          }    
        });
    } catch (err) {
        console.log(err)
    }    
  });
})*/

app.listen(port, () => console.log(`Example app listening on port ${port}!`));