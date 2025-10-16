const axios = require('axios')

const apiCall2 = async (method, url, data, headers) => {
  if (method === 'POST') {
    const call = await axios.post(url, data, { headers });
    return call.data;
  }
  if (method === 'PATCH') {
    console.log('PATCH');
    const call = await axios.patch(url, data, { headers });
    return call.data;
  }
  if (method === 'PUT') {
    console.log('PUT');
    const call = await axios.put(url, data, { headers });
    return call.data;
  }
  const call = await axios.get(url, { headers });
  // console.log(await call, 'There There');
  return call.data;
};

const apiCall = async (method, url, data, headers, options = null) => {
  const axios_data = {
    url: url,
    method: method,
    headers: headers,
    data,
    ...options,
  };
  const call = await axios.request(axios_data);
  return call.data;
};

const axiosGET = async (url, headers, options = {}) => {
  return await apiCall('GET', url, null, headers, options);
};

const axiosPOST = async (url, data, headers, options = {}) => {
  return await apiCall('POST', url, data, headers, options);
};

const axiosPATCH = async (url, data, headers, options = {}) => {
  return await apiCall('PATCH', url, data, headers, options);
};

const axiosPUT = async (url, data, headers, options = {}) => {
  return await apiCall('PUT', url, data, headers, options);
};

module.exports = { apiCall, axiosGET, axiosPOST, axiosPATCH, axiosPUT };
