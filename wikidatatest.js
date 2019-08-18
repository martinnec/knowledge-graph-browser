const express = require('express');
const request = require('request');
const URI = require('uri-js');
const $rdf = require('rdflib');

const app = express();
const port = 3000;

app.get('/test', function (req, res)  {

  res.setHeader('Access-Control-Allow-Origin', '*');
  
  let testurl = "https://query.wikidata.org/sparql?query=PREFIX%20wd:%20%3Chttp://www.wikidata.org/entity/%3E%0APREFIX%20wdt:%20%3Chttp://www.wikidata.org/prop/direct/%3E%0AASK%20%7B%20VALUES%20?node%20%7B%3Chttp://www.wikidata.org/entity/Q135022%3E%7D%20%20%0A%20%20?node%20wdt:P31%20wd:Q16521%20.%0A%7D";
  
  const options = {
    url: testurl,
    headers: {
      'User-Agent': 'https://github.com/martinnec/kgbrowser',
    }
  };

  request(options, function (error, response, body) {
    try{
      if(error) {
        console.log(error);
      } else {
        console.log(body);
      }
    } catch (e) {
      console.log(e);
    }
    res.send(body );                  
  });
});

app.listen(port, () => console.log(`Knowledge graph browser server listening on port ${port}!`));