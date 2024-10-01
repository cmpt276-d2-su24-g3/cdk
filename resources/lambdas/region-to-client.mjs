import { Socket } from 'net';

const headers = {
  "Access-Control-Allow-Origin": '*', // Allows any origin
  "Access-Control-Allow-Credentials": true, // Required if cookies or credentials are involved
  "Content-Type": "application/json",
};

export const handler = async event => {
  const { host } = event;

  if (!host) {
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
    console.error(`Error pinging ${host} from region ${THIS_REGION}:`, err);
    return {
      statusCode: 500,
      headers,
      body: 'Internal Server Error',
    };
  }
};

async function pingHost(host, region) {
  return new Promise((resolve, reject) => {
    const client = new Socket();
    const start = process.hrtime.bigint();

    client.connect(443, host, () => {
      client.end();
      const end = process.hrtime.bigint();
      const latency = Number(end - start) / 1e6;
      console.log(`Pinged ${host} from ${region} in ${latency}ms`);
      resolve(latency);
    });

    client.on('error', (err) => {
      console.error(`Error pinging ${host} from ${region}:`, err);
      reject(err);
    });
  });
}
