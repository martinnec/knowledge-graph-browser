const express = require('express');
const request = require('request');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

app.get('/', function (req, res) {
  res.send('Hello World!');
})

app.get('/configurations', function (req, res)  {

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
      const views = configStore.each(config, VIEW('hasView'), undefined);
       
      function checkViews(views) {
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
<h1>Knowledge graph viewer</h1>
<h2>${resourceiri}</h2>
${output}  
</body>
</html>`);
        } else {
          var view = views.pop() ;
          console.log(view);
          var endpointurl = configStore.any(view, VIEW('endpointurl'), undefined);
          var title = configStore.any(view, DCT('title'), undefined);
          var conditionLiteral = configStore.any(view, VIEW('condition'), undefined);
          var condition = conditionLiteral.value.replace('ASK {', 'ASK { VALUES ?node {<' + resourceiri + '>}');
          var queryurl = endpointurl + '?query=' + encodeURI(condition) + '&format=text%2Fplain';
          
          var store = $rdf.graph();  
          var fetcher = new $rdf.Fetcher(store);
          console.log("ASK: " + queryurl);
          request(queryurl, function (err, response, body) {
            if(err) {
              console.log("Oops, something happened and couldn't fetch data");
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              console.log("RESULT /" + body + "/");
              if(body.includes('true')) {
                output += "<li><a href=\"/resource-graph?resourceiri=" + resourceiri + "&configurl=" + configurl + "&viewiri=" + view.value + "\">" + title + "</a></li>";
                console.log(output);
              }
              checkViews(views);
            }
          });
        }
      }
      
      checkViews(views);             
    } catch (err) {
        console.log(err);
    }    
  });  
                                    
})

app.get('/resource-graph', function (req, res) {
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
        console.log(expansion);
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
              output += "<tr><td>" + statement.subject.uri + "</td><td>" + statement.predicate.uri + "</td>";
              if (statement.object.termType == 'Literal') {
                output += "<td>" + statement.object.value  + "</td></tr>";        
              } else  {
                output += "<td>" + statement.object.uri  + "</td></tr>";        
              }
            }
            var statements = store.statementsMatching(undefined, undefined, resource);
            for (var i=0; i<statements.length;i++)  {
              statement = statements[i];
              output += "<tr><td>" + statement.subject.uri + "</td><td>" + statement.predicate.uri + "</td>";
              if (statement.object.termType == 'Literal') {
                output += "<td>" + statement.object.value  + "</td></tr>";        
              } else  {
                output += "<td>" + statement.object.uri  + "</td></tr>";        
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
<h1>Knowledge graph viewer</h1>
<h2>${title} of ${resourceiri}</h2>
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

app.listen(port, () => console.log(`Example app listening on port ${port}!`));