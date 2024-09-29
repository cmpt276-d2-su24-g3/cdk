import { Socket } from 'net';
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";

const ec2Client = new EC2Client({ region: 'us-west-2' });

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

  console.log(`Pinging ${host} from all AWS regions...`);

  try {
    const regions = await getRegions();
    const results = await Promise.all(regions.map(async region => {
      try {
        const latency = await pingHost(host, region);
        return { region, latency };
      } catch (err) {
        console.error(`Error pinging ${host} from region ${region}:`, err);
        return { region, latency: 'Error' };
      }
    }));

    console.log(`Ping results for ${host}:`, results);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('Error fetching regions or pinging host:', err);
    return {
      statusCode: 500,
      headers,
      body: 'Internal Server Error',
    };
  }
};

async function getRegions() {
  const command = new DescribeRegionsCommand({});
  try {
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
  } catch (err) {
    console.error('Error fetching regions:', err);
    throw err;
  }
}

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
