import { Socket } from 'net';
import { promises as dns } from 'dns';

const headers = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Credentials": true,
  "Content-Type": "application/json",
};



export const handler = async (event) => {
  let body;

  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (err) {
    console.error('Error parsing request body:', err.message);
    return {
      statusCode: 400,
      headers,
      body: 'Invalid request body',
    };
  }

  const { host } = body;

  if (!host) {
    console.error('Host is missing from the request body');
    return {
      statusCode: 400,
      headers,
      body: 'Missing host',
    };
  }

  const THIS_REGION = process.env.THIS_REGION;

  console.log(`Pinging ${host} from region ${THIS_REGION}...`);

  try {
    const latency = await pingHost(host, THIS_REGION);

    const result = { region: THIS_REGION, latency };

    console.log(`Ping results for ${host}:`, result);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error(`Error pinging ${host} from region ${THIS_REGION}:`, err.message);
    return {
      statusCode: 500,
      headers,
      body: `Internal Server Error: ${err.message}`,
    };
  }
};

async function pingHost(host, region) {
  try {
    // Resolve the host to an IP address using DNS
    const addresses = await dns.lookup(host);
    const resolvedHost = addresses.address;

    console.log(`Resolved ${host} to ${resolvedHost}`);

    return new Promise((resolve, reject) => {
      const client = new Socket();
      const start = process.hrtime.bigint();

      client.connect(443, resolvedHost, () => {
        client.end();
        const end = process.hrtime.bigint();
        const latency = Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
        console.log(`Pinged ${host} (IP: ${resolvedHost}) from ${region} in ${latency}ms`);
        resolve(latency);
      });

      client.on('error', (err) => {
        console.error(`Error pinging ${host} from ${region}:`, err.message);
        reject(new Error(`Failed to ping ${host}: ${err.message}`));
      });
    });
  } catch (error) {
    console.error(`Error resolving DNS for ${host}:`, error.message);
    throw new Error(`DNS resolution failed for ${host}`);
  }
}
