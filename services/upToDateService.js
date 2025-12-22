const { CosmosClient } = require("@azure/cosmos");
const { fetchClustersByAppointment } = require("./clustersService");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });
async function fetchUpToDateInfo(keyword){
    try{
       const url = new URL(
        `${process.env.UPTODATE_BASE_URL}/clin/v1/search/clinical.json`
        );

        url.searchParams.append("q", keyword);
        url.searchParams.append("searchType", "keyword");
        url.searchParams.append("limit", 2);
        url.searchParams.append("fields", "results.title,results.results,results.links.webapp");

        const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "subscription-key": process.env.UPTODATE_API_KEY,
            "Cache-Control": "no-cache",
        },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.log("UpToDate API error response:", errorBody);
            throw new Error(`UpToDate API request failed: ${response.status} - ${errorBody}`);
        }
        const data = await response.json();
        return data;
    }
    catch(error){
        console.error("Error fetching UpToDate information:", error);
        throw new Error("Failed to fetch UpToDate information");
    }
}

async function upToDateRecommendation(appId, userId) {
    const data = await fetchClustersByAppointment(`${userId}_${appId}_clusters`, userId);
    const conditions = data.data.conditions_mentioned.conditions;
    let response = {};
    if (conditions?.length === 0) {
        throw new Error("No conditions found for the appointment");
    }
    const keywords = Object.keys(conditions);
    for (let index = 0; index < keywords.length; index++) {
        const data = await fetchUpToDateInfo(keywords[index]);
        response[keywords[index]] = data;
    }
    return response;
}

module.exports = {
    fetchUpToDateInfo,
    upToDateRecommendation
};