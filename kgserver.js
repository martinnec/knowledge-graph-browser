const express = require('express');
const request = require('request');
const URI = require('uri-js');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
const VOID = $rdf.Namespace("http://rdfs.org/ns/void#");
const BROWSER = $rdf.Namespace("https://linked.opendata.cz/ontology/knowledge-graph-browser/");
const RS = $rdf.Namespace("http://www.w3.org/2005/sparql-results#");
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");

app.get('/', function (req, res) {
  
})

app.get('/view-sets', function (req, res)  {

  const configIRI = req.query.config ;
  const resourceIRI = req.query.resource ;
  
  let store = $rdf.graph();
  const config = $rdf.sym(utf8ToUnicode(configIRI));
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(fetchableURI(configIRI)).then(response => {
    let viewSets = store.each(config, BROWSER("hasViewSet"), undefined);
    Promise.all(
      viewSets.map(
        function (viewSet)  {
          return new Promise((resolve, reject) => {
            fetcher.load(fetchableURI(viewSet.value)).then(response => {
              const condition = store.any(viewSet, BROWSER("hasCondition"), undefined);
              const dataset = store.any(viewSet, BROWSER("hasDataset"), undefined);
              fetcher.load(fetchableURI(dataset.value)).then( reponse => {
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
                        resolve(viewSet);
                      }
                      resolve(null);
                    }
                  } catch (e) {
                    console.log(e);
                    reject(viewSet);
                  }                  
                });              
              }, err => {
                console.log("Load failed " +  err);
                reject(viewSet.value);
              });
            }, err => {
               console.log("Load failed " +  err);
               reject(viewSet);
            });
          });
        }
      )
    ).then(response => {
      let output = {
        viewSets: [],
        views: []
      };

      let promises = [];
      for(let i in response) {
        let viewSet = response[i];
        if(viewSet) {
          let views = store.each(viewSet, BROWSER("hasView"), undefined);
          let viewSetOutput = {
            iri: unicodeToUTF8(viewSet.value),
            title: store.any(viewSet, DCT("title"), undefined).value,
            defaultView: unicodeToUTF8(store.any(viewSet, BROWSER("hasDefaultView"), undefined).value),
            views: store.each(viewSet, BROWSER("hasView"), undefined).map(
              function (view) {
                return unicodeToUTF8(view.value)
              }
            )
          }
          output.viewSets.push(viewSetOutput);
          for(let i in views) {
            let view = views[i];
            promises.push(
              new Promise((resolve, reject) => {
                fetcher.load(fetchableURI(view.value)).then(response => {
                  const label = store.any(view, DCT("title"), undefined);
                  resolve({
                    iri: unicodeToUTF8(view.value),
                    label: label.value
                  });
                }, err => {
                  console.log("Load failed " +  err);
                  reject(null);
                });
              })
            );
          }
        }
      }

      Promise.all(promises).then(response => {
        for(let i in response)  {
          let viewOutput = response[i];
          if(viewOutput)  {
            output.views.push(viewOutput);
          }
        }
        res.contentType('application/json');
        res.send(JSON.stringify(output));
      }, err => {
         console.log("Load failed " +  err);
      });
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
  
  let store = $rdf.graph();
  const view = $rdf.sym(utf8ToUnicode(viewIRI));
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(fetchableURI(viewIRI)).then(response => {
    const expansion = store.any(view, BROWSER("hasExpansion"), undefined);
    fetcher.load(fetchableURI(expansion.value)).then( reponse => {
      const dataset = store.any(expansion, BROWSER("hasDataset"), undefined);
      const query = store.any(expansion, BROWSER("query"), undefined);
      const groundedQuery = query.value.replace('WHERE {', 'WHERE { VALUES ?node {<' + resourceIRI + '>}');
      fetcher.load(fetchableURI(dataset.value)).then( reponse => {
        const endpoint = store.any(dataset, VOID("sparqlEndpoint"), undefined);
        const groundedQueryURL = endpoint.value + '?query=' + encodeURI(groundedQuery) + '&format=text%2Fplain';
        request(groundedQueryURL, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              $rdf.parse(body, resultStore, resourceIRI, "text/turtle");
              let statements = resultStore.match(null, null, null);
              let output = {
                nodes: [],
                edges: [],
                types: []
              };
              let nodesMap = new Map();
              let typesSet = new Set();
              for(let i in statements)  {
                if(statements[i].object.termType='NamedNode') {
                  if(!nodesMap.get(statements[i].subject.value)) {
                    nodesMap.set(statements[i].subject.value, {iri:unicodeToUTF8(statements[i].subject.value)});
                  }
                  if(!nodesMap.get(statements[i].object.value)) {
                    nodesMap.set(statements[i].object.value, {iri:unicodeToUTF8(statements[i].object.value)});
                  }
                  if(!typesSet.has(statements[i].predicate.value)) {
                    typesSet.add(statements[i].predicate.value);
                  }
                  edge = {
                    source: unicodeToUTF8(statements[i].subject.value),
                    target: unicodeToUTF8(statements[i].object.value),
                    type: unicodeToUTF8(statements[i].predicate.value)
                  } 
                  output.edges.push(edge);
                }
              }
              for(let value of nodesMap.values()) {
                output.nodes.push(value);
              }
              
              let promises = [];
              for(let typeIRIUnicode of typesSet)  {
                promises.push(new Promise((resolve, reject) => {
                  let store = $rdf.graph();
                  const fetcher = new $rdf.Fetcher(store);
                  const typeIRI = fetchableURI(typeIRIUnicode);
                  const type = $rdf.sym(typeIRIUnicode);
                  fetcher.load(typeIRI).then(response => {
                    const label = getResourceLabel(store, type);
                    const description = getResourceDescription(store, type);
                    let node = {
                      iri: unicodeToUTF8(typeIRIUnicode),
                    } 
                    if(label) {
                      node.label = label.value;
                    }
                    if(description) {
                      node.description = description.value;
                    }
                    output.types.push(node);
                    resolve(typeIRI);
                  }, err => {
                     console.log("Load failed " +  err);
                     reject(typeIRI);
                  });
                }));
              }
              Promise.all(promises).then(response => {
                res.contentType('application/json');
                res.send(JSON.stringify(output));
              }, err => {
                 console.log("Load failed " +  err);
              });    

            }
          } catch (e) {
            console.log(e);
          }                  
        });              
      }, err => {
        console.log("Load failed " +  err);
      });    
    }, err => {
      console.log("Load failed " +  err);
    });
  }, err => {
     console.log("Load failed " +  err);
  }); 

});

app.get('/preview', function (req, res)  {

  const viewIRI = req.query.view ;
  const resourceIRI = req.query.resource ;
  
  let store = $rdf.graph();
  const view = $rdf.sym(utf8ToUnicode(viewIRI));
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(fetchableURI(viewIRI)).then(response => {
    const preview = store.any(view, BROWSER("hasPreview"), undefined);
    fetcher.load(fetchableURI(preview.value)).then( reponse => {
      const dataset = store.any(preview, BROWSER("hasDataset"), undefined);
      const query = store.any(preview, BROWSER("query"), undefined);
      const groundedQuery = query.value.replace('WHERE {', 'WHERE { VALUES ?node {<' + resourceIRI + '>}');
      fetcher.load(fetchableURI(dataset.value)).then( reponse => {
        const endpoint = store.any(dataset, VOID("sparqlEndpoint"), undefined);
        const groundedQueryURL = endpoint.value + '?query=' + encodeURIComponent(groundedQuery) + '&format=text%2Fplain';
        request(groundedQueryURL, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              let resource = $rdf.sym(utf8ToUnicode(resourceIRI));
              $rdf.parse(body, resultStore, resourceIRI, "text/turtle");
              const label = getResourceLabel(resultStore, resource);
              let output =  {
                nodes: [{
                  iri: unicodeToUTF8(resourceIRI),
                  type: unicodeToUTF8(resultStore.any(resource, RDF("type"), undefined).value),
                  label: label.value
                }],
                types: []
              }
              const stmts = resultStore.match(resource, RDF("type"));
              let typesSet = new Set();
              for(let i in stmts) {
                const stmt = stmts[i];
                if(!typesSet.has(stmt.object.value)) {
                  typesSet.add(stmt.object.value);
                }
              }
              
              let promises = [];
              for(let typeIRIUnicode of typesSet)  {
                promises.push(new Promise((resolve, reject) => {
                  let store = $rdf.graph();
                  const fetcher = new $rdf.Fetcher(store);
                  const typeIRI = fetchableURI(typeIRIUnicode);
                  const type = $rdf.sym(typeIRIUnicode);
                  fetcher.load(typeIRI).then(response => {
                    const label = getResourceLabel(store, type);
                    const description = getResourceDescription(store, type);
                    let node = {
                      iri: unicodeToUTF8(typeIRIUnicode),
                    } 
                    if(label) {
                      node.label = label.value;
                    }
                    if(description) {
                      node.description = description.value;
                    }
                    output.types.push(node);
                    resolve(typeIRI);
                  }, err => {
                     console.log("Load failed " +  err);
                     reject(typeIRI);
                  });
                }));
              }
              Promise.all(promises).then(response => {
                res.contentType('application/json');
                res.send(JSON.stringify(output));
              }, err => {
                 console.log("Load failed " +  err);
              });
            }
          } catch (e) {
            console.log(e);
          }                  
        });              
      }, err => {
        console.log("Load failed " +  err);
      });    
    }, err => {
      console.log("Load failed " +  err);
    });
  }, err => {
     console.log("Load failed " +  err);
  });

});

app.get('/detail', function (req, res)  {

  const viewIRI = req.query.view ;
  const resourceIRI = req.query.resource ;
  
  let store = $rdf.graph(); 
  const view = $rdf.sym(utf8ToUnicode(viewIRI));
  const fetcher = new $rdf.Fetcher(store);    
  fetcher.load(fetchableURI(viewIRI)).then(response => {
    const detail = store.any(view, BROWSER("hasDetail"), undefined);    
    fetcher.load(fetchableURI(detail.value)).then( reponse => {
      const dataset = store.any(detail, BROWSER("hasDataset"), undefined);
      const query = store.any(detail, BROWSER("query"), undefined);
      const groundedQuery = query.value.replace('WHERE {', 'WHERE { VALUES ?node {<' + resourceIRI + '>}');
      fetcher.load(fetchableURI(dataset.value)).then( reponse => {
        const endpoint = store.any(dataset, VOID("sparqlEndpoint"), undefined);
        const groundedQueryURL = endpoint.value + '?query=' + encodeURIComponent(groundedQuery) + '&format=text%2Fplain';
        request(groundedQueryURL, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              let resource = $rdf.sym(utf8ToUnicode(resourceIRI));
              $rdf.parse(body, resultStore, resourceIRI, "text/turtle");
              const stmts = resultStore.match(resource, null);
              let node =  {
                iri: unicodeToUTF8(resourceIRI),
                data: {}
              };
              let output = {
                nodes: [],
                types: []
              }
              let typesSet = new Set();
              for(let i in stmts) {
                const stmt = stmts[i];
                node.data[unicodeToUTF8(stmt.predicate.uri)] = stmt.object.value;
                if(stmt.object.termType='NamedNode') {
                  if(!typesSet.has(stmt.predicate.value)) {
                    typesSet.add(stmt.predicate.value);
                  }
                }
              }
              output.nodes.push(node);
              
              let promises = [];
              for(let typeIRIUnicode of typesSet)  {
                promises.push(new Promise((resolve, reject) => {
                  let store = $rdf.graph();
                  const fetcher = new $rdf.Fetcher(store);
                  const typeIRI = fetchableURI(typeIRIUnicode);
                  const type = $rdf.sym(typeIRIUnicode);
                  fetcher.load(typeIRI).then(response => {
                    const label = getResourceLabel(store, type);
                    const description = getResourceDescription(store, type);
                    let node = {
                      iri: unicodeToUTF8(typeIRIUnicode),
                    } 
                    if(label) {
                      node.label = label.value;
                    }
                    if(description) {
                      node.description = description.value;
                    }
                    output.types.push(node);
                    resolve(typeIRI);
                  }, err => {
                     console.log("Load failed " +  err);
                     reject(typeIRI);
                  });
                }));
              }
              Promise.all(promises).then(response => {
                res.contentType('application/json');
                res.send(JSON.stringify(output));
              }, err => {
                 console.log("Load failed " +  err);
              });
            }
          } catch (e) {
            console.log(e);
          }                  
        });              
      }, err => {
        console.log("Load failed " +  err);
      });    
    }, err => {
      console.log("Load failed " +  err);
    });
  }, err => {
     console.log("Load failed " +  err);
  });

});

app.get('/stylesheet', function (req, res)  {

  const stylesheetIRI = req.query.stylesheet ;
  
  let store = $rdf.graph();
  const stylesheet = $rdf.sym(utf8ToUnicode(stylesheetIRI));
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(fetchableURI(stylesheetIRI)).then(response => {
    let styles = store.each(stylesheet, BROWSER("hasVisualStyle"), undefined);
    let output = {
      styles: []
    }
    Promise.all(
      styles.map(
        function (style)  {
          return new Promise((resolve, reject) => {
            fetcher.load(fetchableURI(style.value)).then(response => {
              let selectorLiteral = store.any(style, BROWSER("hasSelector"), undefined).value ;
              let selector ;
              if (selectorLiteral=="node") {
                selector = "node";
              } else if (selectorLiteral=="edge") {
                selector = "edge";
              } else {
                selector = "node[type='" + unicodeToUTF8(selectorLiteral) + "']"
              }
              let styleOutput = {
                selector: selector,
                properties: {}
              };
              const stmts = store.match(style, null);             
              for(let i in stmts) {
                const stmt = stmts[i];
                const styleProperty = unicodeToUTF8(stmt.predicate.uri);
                if (styleProperty.startsWith("https://linked.opendata.cz/ontology/knowledge-graph-browser/") && !styleProperty.endsWith("hasSelector")) {
                  styleOutput.properties[unicodeToUTF8(stmt.predicate.uri).substr(60)] = stmt.object.value;
                }
              }
              output.styles.push(styleOutput);
              resolve(style);
            }, err => {
               console.log("Load failed " +  err);
               reject(style);
            });
          });
        }
      )
    ).then(response => {
      res.contentType('application/json');
      res.send(JSON.stringify(output));
    }, err => {
       console.log("Load failed " +  err);
    });    
  }, err => {
     console.log("Load failed " +  err);
  }); 
                                    
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

function fetchableURI(source) {
  let state=0;
  let chars=0;
  let value="";
  let result = "";

  for (let i=0; i<source.length; i++) {
    switch (state) {
      case 0:
        if (source.charAt(i)=='\\') {
          state=1;
        } else {
          result+=source.charAt(i);
        }
      break;
      case 1:
        if (source.charAt(i)=='u') {
          state=2;
          chars=0;
          value="";
        } else {
          result+='\\'+source.charAt(i);
          state = 0;
        }
      break;
      case 2:
        chars++;
        value+=source.charAt(i);
        if (chars>=4) {
          result+=unescape("%u"+value);
          state=0;
        }
      break;
    }
  }
  
  let pattern = new RegExp(/(http(s)?:\/\/([^\/]+)\/)(.*)/g);
  let e = result.replace(pattern, "$4");
  let b = result.replace(pattern, "$1");

  return b+encodeURI(e);
}

function unicodeToUTF8(source) {
  let state=0;
  let chars=0;
  let value="";
  let result = "";

  for (let i=0; i<source.length; i++) {
    switch (state) {
      case 0:
        if (source.charAt(i)=='\\') {
          state=1;
        } else {
          result+=source.charAt(i);
        }
      break;
      case 1:
        if (source.charAt(i)=='u') {
          state=2;
          chars=0;
          value="";
        } else {
          result+='\\'+source.charAt(i);
          state = 0;
        }
      break;
      case 2:
        chars++;
        value+=source.charAt(i);
        if (chars>=4) {
          result+=unescape("%u"+value);
          state=0;
        }
      break;
    }
  }

  return result;
}

function utf8ToUnicode(source) {
  let state=0;
  let chars=0;
  let value="";
  let result = "";

  for (let i=0; i<source.length; i++) {
    let character = source.charAt(i);
    if(character > '~')  {
      let newCharacter = source.charCodeAt(i).toString(16).toUpperCase();
      if(newCharacter.length==2) { 
        result += "\\u00" + source.charCodeAt(i).toString(16).toUpperCase();
      } else if(newCharacter.length==3) { 
        result += "\\u0" + source.charCodeAt(i).toString(16).toUpperCase();
      } else if(newCharacter.length==4) { 
        result += "\\u" + source.charCodeAt(i).toString(16).toUpperCase();
      }                   
    } else {
      result += character;    
    }
  }

  return result;
}

function getResourceLabel(store, resource)  {

  const properties = [RDFS("label"), DCT("title"), SKOS("prefLabel")];
  for(let i in properties)  {
    const label = store.any(resource, properties[i], undefined);
    if(label) {
      return label ;
    }
  }

  return null;

}

function getResourceDescription(store, resource)  {

  const properties = [RDFS("comment"), DCT("description"), SKOS("definition")];
  for(let i in properties)  {
    const desc = store.any(resource, properties[i], undefined);
    if(desc) {
      return desc ;
    }
  }

  return null;

}