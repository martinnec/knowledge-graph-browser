const express = require('express');
const request = require('request');
const URI = require('uri-js');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const DCT = $rdf.Namespace("http://purl.org/dc/terms/");
const DCE = $rdf.Namespace("http://purl.org/dc/elements/1.1/");
const VOID = $rdf.Namespace("http://rdfs.org/ns/void#");
const BROWSER = $rdf.Namespace("https://linked.opendata.cz/ontology/knowledge-graph-browser/");
const RS = $rdf.Namespace("http://www.w3.org/2005/sparql-results#");
const SKOS = $rdf.Namespace("http://www.w3.org/2004/02/skos/core#");
const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");

app.get('/', function (req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  
})


app.get('/view-sets', function (req, res)  {

  res.setHeader('Access-Control-Allow-Origin', '*');
                 
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
                const groundedConditionQueryURL = endpoint.value + '?query=' + encodeURIComponent(groundedCondition) + '&format=text%2Fplain'
                console.log("view-sets:\n" + groundedConditionQueryURL);
                const options = {
                  url: groundedConditionQueryURL,
                  headers: {
                    'User-Agent': 'https://github.com/martinnec/kgbrowser',
                  }
                }; 
                request(options, function (error, response, body) {
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
            label: store.any(viewSet, DCT("title"), undefined).value,
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

  res.setHeader('Access-Control-Allow-Origin', '*');

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
        const accept = store.any(dataset, BROWSER("accept"), undefined);
        let options = {
          headers: {
            'User-Agent': 'https://github.com/martinnec/kgbrowser',
          }
        }; 
        if(accept)  {
          options.headers['Accept'] = accept.value ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);      
        } else {
          options.headers['Accept'] = "text/turtle" ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);
        } 
        console.log("expand:\n" + options.url); 
        request(options, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              if(options.headers['Accept'] == "application/sparql-results+json")  {
                parseSPARQLResultsJSON(body, resultStore, resourceIRI);
              } else {
                $rdf.parse(body, resultStore, resourceIRI, options.headers['Accept']);
              }
              let statements = resultStore.match(null, null, null);

              let output = {
                nodes: [],
                edges: [],
                types: []
              };
              let nodesMap = new Map();
              let nodeNamesMap = new Map();
              let nodeTypesMap = new Map();
              let typesSet = new Set();
              for(let i in statements)  {
                let statement = statements[i];
                let subjectIRI = unicodeToUTF8(statement.subject.value);
                let predicateIRI = unicodeToUTF8(statement.predicate.value);
                let objectValue = statement.object.value;
                let subject = nodesMap.get(subjectIRI);
                if(!subject)  {
                  subject = {iri:subjectIRI};
                }
                if(statement.object.termType=='NamedNode') {
                  objectValue = unicodeToUTF8(objectValue);
                  if(predicateIRI==RDF("type").value) {
                    if(!typesSet.has(objectValue)) {
                      typesSet.add(objectValue);
                    }
                    subject.type = objectValue ;
                  } else {
                    if(!nodesMap.get(objectValue)) {
                      nodesMap.set(objectValue, {iri:objectValue});
                    }
                    if(!typesSet.has(predicateIRI)) {
                      typesSet.add(predicateIRI);
                    }
                    edge = {
                      source: subjectIRI,
                      target: objectValue,
                      type: predicateIRI
                    } 
                    output.edges.push(edge);
                  }
                } else {
                  if([RDFS("label").value, DCT("title").value, SKOS("prefLabel").value, DCE("title").value].includes(predicateIRI)) {
                    subject.label = objectValue ;
                  } else if(predicateIRI==BROWSER("class").value) {
                    if(!subject.classes)  {
                      subject.classes = [];
                    }
                    subject.classes.push(objectValue) ;
                  }
                }
                nodesMap.set(subjectIRI, subject);
              }
              for(let value of nodesMap.values()) {
                if(value.iri!=resourceIRI)  {
                  if(typesSet.has(value.iri)) {
                    output.edges.forEach(function(edge) {
                      if(edge.type == value.iri) {
                        edge.classes = value.classes;
                      }
                    });
                  } else {
                    output.nodes.push(value);
                  }
                }
              }
              
              let promises = [];
              for(let typeIRIUTF8 of typesSet)  {
                promises.push(new Promise((resolve, reject) => {
                  let store = $rdf.graph();
                  const fetcher = new $rdf.Fetcher(store);
                  const typeIRI = fetchableURI(typeIRIUTF8);
                  const typeIRIUnicode = utf8ToUnicode(typeIRIUTF8);
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

  res.setHeader('Access-Control-Allow-Origin', '*');

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
        const accept = store.any(dataset, BROWSER("accept"), undefined);
        let options = {
          headers: {
            'User-Agent': 'https://github.com/martinnec/kgbrowser',
          }
        }; 
        if(accept)  {
          options.headers['Accept'] = accept.value ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);      
        } else {
          options.headers['Accept'] = "text/turtle" ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);
        } 
        console.log("preview:\n" + options.url); 
        request(options, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              let resource = $rdf.sym(utf8ToUnicode(resourceIRI));
              if(options.headers['Accept'] == "application/sparql-results+json")  {
                parseSPARQLResultsJSON(body, resultStore, resourceIRI);
              } else {
                $rdf.parse(body, resultStore, resourceIRI, options.headers['Accept']);
              }
              const label = getResourceLabel(resultStore, resource);
              let output =  {
                nodes: [{
                  iri: unicodeToUTF8(resourceIRI),
                  type: unicodeToUTF8(resultStore.any(resource, RDF("type"), undefined).value),
                  label: label.value                  
                }],
                types: []
              }
              const stmtsClasses = resultStore.match(resource, BROWSER("class"));
              output.nodes[0].classes = [];
              for(let i in stmtsClasses) {
                const stmtClass = stmtsClasses[i];
                output.nodes[0].classes.push(stmtClass.object.value);
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

  res.setHeader('Access-Control-Allow-Origin', '*');

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
      //const groundedQuery = query.value.replace(/\?node/g, '<' + resourceIRI + '>');
      fetcher.load(fetchableURI(dataset.value)).then( reponse => {
        const endpoint = store.any(dataset, VOID("sparqlEndpoint"), undefined);
        const accept = store.any(dataset, BROWSER("accept"), undefined);
        let options = {
          headers: {
            'User-Agent': 'https://github.com/martinnec/kgbrowser',
          }
        }; 
        if(accept)  {
          options.headers['Accept'] = accept.value ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);      
        } else {
          options.headers['Accept'] = "text/turtle" ;
          options.url = endpoint.value + '?query=' + encodeURIComponent(groundedQuery);
        } 
        console.log("detail:\n" + options.url); 
        request(options, function (error, response, body) {
          try{
            if(error) {
              res.send("Oops, something happened and couldn't fetch data");
            } else {
              let resultStore = $rdf.graph();
              let resource = $rdf.sym(utf8ToUnicode(resourceIRI));
              if(options.headers['Accept'] == "application/sparql-results+json")  {
                parseSPARQLResultsJSON(body, resultStore, resourceIRI);
              } else {
                $rdf.parse(body, resultStore, resourceIRI, options.headers['Accept']);
              }
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

  res.setHeader('Access-Control-Allow-Origin', '*');

  const stylesheetIRI = req.query.stylesheet ;
  
  let store = $rdf.graph();
  const stylesheet = $rdf.sym(utf8ToUnicode(stylesheetIRI));
  const fetcher = new $rdf.Fetcher(store);
    
  fetcher.load(fetchableURI(stylesheetIRI)).then(response => {
    let styles = store.each(stylesheet, BROWSER("hasVisualStyle"), undefined);
    let output = {
      styles: []
    }
    let nodeStyleOutput;
    let edgeStyleOutput;
    Promise.all(
      styles.map(
        function (style)  {
          return new Promise((resolve, reject) => {
            fetcher.load(fetchableURI(style.value)).then(response => {
              let selectorLiteral = store.any(style, BROWSER("hasSelector"), undefined).value ;
              let selector ;
              if (selectorLiteral.startsWith("node")) {
                selector = selectorLiteral;
              } else if (selectorLiteral.startsWith("edge")) {
                selector = selectorLiteral;
              } else if (selectorLiteral.startsWith("."))  {
                selector = selectorLiteral;              
              } else {
                selector = "node[type='" + unicodeToUTF8(selectorLiteral) + "']";
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
              if (selector == "node") {
                nodeStyleOutput = styleOutput;
              } else if (selector == "edge") {
                edgeStyleOutput = styleOutput;
              } else  { 
                output.styles.push(styleOutput);
              }
              resolve(style);
            }, err => {
               console.log("Load failed " +  err);
               reject(style);
            });
          });
        }
      )
    ).then(response => {
      let finalStyles = [];
      if(nodeStyleOutput) {
        finalStyles.push(nodeStyleOutput);
      }
      if(edgeStyleOutput) {
        finalStyles.push(edgeStyleOutput);
      }
      output.styles = finalStyles.concat(output.styles);
      output.styles.sort( compareStyles );
      res.contentType('application/json');
      res.send(JSON.stringify(output));
    }, err => {
       console.log("Load failed " +  err);
    });    
  }, err => {
     console.log("Load failed " +  err);
  }); 
                                    
});

app.listen(port, () => console.log(`Knowledge graph browser server listening on port ${port}!`));

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

  const properties = [RDFS("label"), DCT("title"), SKOS("prefLabel"), DCE("title")];
  for(let i in properties)  {
    const label = store.any(resource, properties[i], undefined);
    if(label) {
      return label ;
    }
  }

  return null;

}

function getResourceDescription(store, resource)  {

  const properties = [RDFS("comment"), DCT("description"), SKOS("definition"), DCE("description")];
  for(let i in properties)  {
    const desc = store.any(resource, properties[i], undefined);
    if(desc) {
      return desc ;
    }
  }

  return null;

}

function parseSPARQLResultsJSON(body, store, source) {

  let subject, predicate, object;
  let bnodes = {};               
  let why = $rdf.sym(source);
  let parsedBody = JSON.parse(body);
  
  if(parsedBody.head.vars.includes("subject") && parsedBody.head.vars.includes("predicate") && parsedBody.head.vars.includes("object")) {
    let data = parsedBody.results.bindings;
    for(let i in data)  {
      if(data[i].subject.type == "uri") {
        subject = $rdf.sym(data[i].subject.value);
        predicate = $rdf.sym(data[i].predicate.value);
        if(data[i].object.type == "uri") {
          object = $rdf.sym(data[i].object.value);
          store.add(subject, predicate, object, why)
        } else {
          if(data[i].object.type == "literal") {
            if(data[i].object["xml:lang"]) {
              object = $rdf.literal(data[i].object.value, data[i].object["xml:lang"]);
            } else {
              object = $rdf.literal(data[i].object.value);
            }
          }
        }
        store.add(subject, predicate, object, why);
      }
    }
  } 

}

function compareStyles( a, b ) {
  if ( a.selector.length < b.selector.length ){
    return -1;
  }
  if ( a.selector.length > b.selector.length ){
    return 1;
  }
  return 0;
}