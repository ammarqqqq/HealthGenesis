import loGet from 'lodash/get';
import dicomTags from './dicomTags';

function buildQueryString(query) {
  return Object.keys(query).filter(it => !!query[it]).map(key => `${key}=${encodeURIComponent(query[key])}`).join('&');
}

function search(url, query) {
  const queryString = buildQueryString(query);
  let finalUrl = url;
  if (queryString) {
    finalUrl += '?' + queryString;
  }
  return fetch(finalUrl, {
    headers: {
      'Accept': 'application/json'
    }
  }).then(function (response) {
    if (!response.ok) {
      return response.text().then(function (body) {
        throw new Error(`${response.status} ${response.statusText} ${body}`);
      });
    }
    return response.json();
  })
    .then(function (json) {
      return json.map(it => Object.keys(it).reduce((result, dicomId) => {
        const tagName = dicomTags.byId[dicomId];
        if (tagName) {
          result[tagName] = loGet(it[dicomId], 'Value[0].Alphabetic', it[dicomId].Value[0]);
        }
        return result;
      }, {}));
    });
}

export default { search };
