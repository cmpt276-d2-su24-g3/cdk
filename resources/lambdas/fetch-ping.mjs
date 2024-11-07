import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'PingDB';

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { origin, destinations, timeframe } = body;

        // Validate input
        if (!origin || !destinations || !timeframe) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameters' })
            };
        }

        const result = {};

        // Handle each destination in parallel
        await Promise.all(destinations.map(async (destination) => {
            if (timeframe === 'latest') {
                result[destination] = await getLatestLatency(origin, destination);
            } else {
                result[destination] = await getAverageLatency(origin, destination, timeframe);
            }
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getLatestLatency(origin, destination) {
    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'origin = :origin AND begins_with(#destTimestamp, :destPrefix)',
        // Necessary due to reserved character #
        ExpressionAttributeNames: {
            '#destTimestamp': 'destination#timestamp'
        },
        ExpressionAttributeValues: {
            ':origin': origin,
            ':destPrefix': `${destination}#`
        },
        Limit: 1,
        ScanIndexForward: false
    };

    const response = await ddbDocClient.send(new QueryCommand(params));
    return response.Items?.[0]?.latency ?? null;
}

async function getAverageLatency(origin, destination, timeframe) {
    const startTime = getStartTime(timeframe);
    let items = [];
    let lastEvaluatedKey = null;

    console.log('Query Parameters:', {
        origin,
        destination,
        timeframe,
        startTime
    });

    do {
        const params = {
            TableName: TABLE_NAME,
            KeyConditionExpression: 'origin = :origin AND begins_with(#destTimestamp, :destPrefix)',
            // Necessary due to reserved character # and reserved word timestamp
            ExpressionAttributeNames: {
                '#destTimestamp': 'destination#timestamp',
                '#ts': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':origin': origin,
                ':destPrefix': `${destination}#`,
                ':startTime': startTime
            },
            FilterExpression: '#ts >= :startTime'
        };

        console.log('DynamoDB Query Params:', JSON.stringify(params, null, 2));

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const response = await ddbDocClient.send(new QueryCommand(params));
        console.log(`Retrieved ${response.Items?.length} items for ${destination}`);
        if (response.Items?.length > 0) {
            console.log('First item:', JSON.stringify(response.Items[0]));
            console.log('Last item:', JSON.stringify(response.Items[response.Items.length - 1]));
        }
        items = items.concat(response.Items || []);
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (items.length === 0) return null;
    
    const sum = items.reduce((acc, item) => acc + item.latency, 0);
    return sum / items.length;
}

function getStartTime(timeframe) {
    const now = new Date();
    let startTime;
    
    console.log('Current timestamp:', now.toISOString());
    
    switch (timeframe) {
        case '1d':
            startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            console.log('1d startTime:', startTime.toISOString());
            return startTime.toISOString();
        case '7d':
            startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            console.log('7d startTime:', startTime.toISOString());
            return startTime.toISOString();
        case '30d':
            startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            console.log('30d startTime:', startTime.toISOString());
            return startTime.toISOString();
        default:
            throw new Error('Invalid timeframe');
    }
}
