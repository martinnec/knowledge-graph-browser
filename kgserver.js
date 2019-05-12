const express = require('express');
const request = require('request');
const URI = require('uri-js');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

app.get('/', function (req, res) {
  
})

app.get('/view-sets', function (req, res)  {

  const configIRI = req.query.config ;
  const resourceIRI = req.query.resource ;

  const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
  const VOID = $rdf.Namespace("http://rdfs.org/ns/void#");
  const BROWSER = $rdf.Namespace("https://linked.opendata.cz/ontology/knowledge-graph-browser/");
  const RS = $rdf.Namespace("http://www.w3.org/2005/sparql-results#");
  
  let store = $rdf.graph();
  const config = $rdf.sym(configIRI);
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(configIRI).then(response => {
    let viewSets = store.each(config, BROWSER("hasViewSet"), undefined);
    Promise.all(
      viewSets.map(
        function (viewSet)  {
          return new Promise((resolve, reject) => {
            fetcher.load(viewSet.value).then(response => {
              const condition = store.any(viewSet, BROWSER("hasCondition"), undefined);
              const dataset = store.any(viewSet, BROWSER("hasDataset"), undefined);
              fetcher.load(dataset.value).then( reponse => {
                const endpoint = store.any(dataset, VOID("sparqlEndpoint"), undefined);
                const groundedCondition = condition.value.replace('ASK {', 'ASK { VALUES ?node {<' + resourceIRI + '>}');
                const groundedConditionQueryURL = endpoint.value + '?query=' + encodeURI(groundedCondition) + '&format=text%2Fplain'; 
                request(groundedConditionQueryURL, function (error, response, body) {
                  try{
                    if(error) {
                      res.send("Oops, something happened and couldn't fetch data");
                      reject(viewSet.value);
                    } else {
                      if(body.includes('true')) {
                        resolve(viewSet.value);
                      }
                      resolve(null);
                    }
                  } catch (e) {
                    console.log(e);
                    reject(viewSet.value);
                  }                  
                });              
              }, err => {
                console.log("Load failed " +  err);
                reject(viewSet.value);
              });
            }, err => {
               console.log("Load failed " +  err);
               reject(viewSet.value);
            });
          });
        }
      )
    ).then(response => {
      res.contentType('application/json');
      let output = [];
      for(i in response)  {
        if(response[i]) {
          output.push(response[i]);
        }      
      }
      res.send(JSON.stringify(output));
    }, err => {
       console.log("Load failed " +  err);
    });    
  }, err => {
     console.log("Load failed " +  err);
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

app.listen(port, () => console.log(`Example app listening on port ${port}!`));