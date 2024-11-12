import https from 'https';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import axios from 'axios';
import type { ApplicationConfiguration } from '../types';

export const createInstance = (config: ApplicationConfiguration): AxiosInstance => {
  const axiosConfig: AxiosRequestConfig = {
    maxBodyLength: config.chunkSize,
    maxContentLength: config.chunkSize,
    httpsAgent: new https.Agent({
      rejectUnauthorized: config.sslVerify,
      requestCert: true
    })
  };
  if (config.auth) {
    const token = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
    axios.defaults.headers.common['Authorization'] = `Basic ${token}`;
  }
  return axios.create(axiosConfig);
};
