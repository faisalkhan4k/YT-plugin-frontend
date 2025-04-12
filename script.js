// ✅ API Key & base URL
const API_KEY = "AIzaSyBmbEao-um6KfRTvCAcGIHx-pZDu1gPb_M";
const API_URL = "http://localhost:5000";
const outputDiv = document.getElementById("output");

function getVideoIdFromUrl(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&\n]+)/);
  return match ? match[1] : null;
}

async function startAnalysis() {
  const url = document.getElementById("video-url").value;
  const videoId = getVideoIdFromUrl(url);
  if (!videoId) {
    alert("Invalid YouTube URL");
    return;
  }

  outputDiv.innerHTML = "<p>Fetching comments...</p>";
  const comments = await fetchComments(videoId);
  outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Analyzing...</p>`;

  const predictions = await getSentimentPredictions(comments);
  
  if (predictions) {
    const sentimentCounts = { 1: 0, 0: 0, "-1": 0 };
    const sentimentData = []; // For trend graph

    const totalSentimentScore = predictions.reduce(
      (sum, item) => sum + parseInt(item.sentiment),
      0
    );

    predictions.forEach((item) => {
      sentimentCounts[item.sentiment]++;
      sentimentData.push({
        timestamp: item.timestamp,
        sentiment: parseInt(item.sentiment),
      });
    });

    console.log("Sentiment Counts:", sentimentCounts);
    console.log("Total Sentiment Score:", totalSentimentScore);
    console.log("Sentiment Data:", sentimentData);

    // Optional: use this to update your DOM or graph
  }
  else return;


  displayPredictions(predictions);
  console.log(predictions);
  
  const sentimentCounts = predictions.sentiment_counts;
  console.log(sentimentCounts)
  const sentimentData = predictions.data;

  await fetchAndDisplayChart(sentimentCounts);
  await fetchAndDisplayWordCloud(comments); // ✅ fixed inside function
  await fetchAndDisplayTrendGraph(sentimentData);

  const recommendations = await fetchProductRecommendations(
    comments,
    sentimentCounts
  );
  displayRecommendations(recommendations);
}

function displayPredictions(predictions) {
  const resultDiv = document.getElementById("results");

  let positive = 0,
    negative = 0,
    neutral = 0;

  predictions.forEach((p) => {
    if (p.sentiment === "1") positive++;
    else if (p.sentiment === "-1") negative++;
    else neutral++;
  });

  const total = predictions.length;
  const toPercent = (count) => ((count / total) * 100).toFixed(1);

  let html = `<h3>Sentiment Analysis Results</h3>`;
  html += `<p><strong>Positive:</strong> ${positive} (${toPercent(
    positive
  )}%)</p>`;
  html += `<p><strong>Neutral:</strong> ${neutral} (${toPercent(
    neutral
  )}%)</p>`;
  html += `<p><strong>Negative:</strong> ${negative} (${toPercent(
    negative
  )}%)</p>`;

  // Add example comments (optional)
  html += `<h4>Sample Comments:</h4>`;
  predictions.slice(0, 5).forEach((p, i) => {
    const label =
      p.sentiment === "1"
        ? "🟢 Positive"
        : p.sentiment === "-1"
        ? "🔴 Negative"
        : "🟡 Neutral";
    html += `<p><em>${label}</em>: ${p.comment}</p>`;
  });

  resultDiv.innerHTML = html;
}

async function fetchComments(videoId) {
let comments = [];
let pageToken = "";
try {
    while (comments.length < 100) {
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${API_KEY}`
    );
    const data = await response.json();
    if (data.items) {
        data.items.forEach((item) => {
        const commentText =
            item.snippet.topLevelComment.snippet.textOriginal;
        const timestamp = item.snippet.topLevelComment.snippet.publishedAt;
        const authorId =
            item.snippet.topLevelComment.snippet.authorChannelId?.value ||
            "Unknown";
        comments.push({
            text: commentText,
            timestamp: timestamp,
            authorId: authorId,
        });
        });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    }
} catch (error) {
    console.error("Error fetching comments:", error);
    outputDiv.innerHTML += "<p>Error fetching comments.</p>";
}
return comments;
}

async function getSentimentPredictions(comments) {
  try {
    const response = await fetch(`${API_URL}/predict_with_timestamps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });
    const result = await response.json();
    if (response.ok){
        return result;
    }
    else{
        throw new Error(result.error || "Error fetching predictions");
    }
  } catch (error) {
    console.error("Error fetching predictions:", error);
    outputDiv.innerHTML += "<p>Error fetching sentiment predictions.</p>";
    return null;
  }
}

async function fetchAndDisplayChart(sentimentCounts) {
  try {
    const response = await fetch(`${API_URL}/generate_chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_counts: sentimentCounts }),
    });
    if (!response.ok) throw new Error("Failed to fetch chart image");
    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    document.getElementById("chart-container").appendChild(img);
  } catch (error) {
    console.error("Error fetching chart image:", error);
    outputDiv.innerHTML += "<p>Error fetching chart image.</p>";
  }
}

async function fetchAndDisplayWordCloud(comments) {
  try {
    const texts = comments.map((comment) => comment.text); // ✅ only send text
    const response = await fetch(`${API_URL}/generate_wordcloud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: texts }),
    });
    if (!response.ok) throw new Error("Failed to fetch word cloud image");
    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    document.getElementById("wordcloud-container").appendChild(img);
  } catch (error) {
    console.error("Error fetching word cloud image:", error);
    outputDiv.innerHTML += "<p>Error fetching word cloud image.</p>";
  }
}

async function fetchAndDisplayTrendGraph(sentimentData) {
  try {
    const response = await fetch(`${API_URL}/generate_trend_graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_data: sentimentData }),
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok || !contentType || !contentType.includes("image/png")) {
      throw new Error("Failed to fetch trend graph image");
    }

    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    document.getElementById("trend-graph-container").appendChild(img);
  } catch (error) {
    console.error("Error fetching trend graph image:", error);
    outputDiv.innerHTML += "<p>Error fetching trend graph image.</p>";
  }
}

async function fetchProductRecommendations(comments, sentimentCounts) {
  try {
    const texts = comments.map((comment) => comment.text); // ✅ only send text
    const response = await fetch(`${API_URL}/get_recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: texts }),
    });
    if (!response.ok)
      throw new Error("Failed to fetch product recommendations");
    const result = await response.json();
    return result.recommendations;
  } catch (error) {
    console.error("Error fetching product recommendations:", error);
    outputDiv.innerHTML += "<p>Error fetching recommendations.</p>";
    return null;
  }
}

function displayRecommendations(recommendations) {
  const container = document.getElementById("recommendations-container");
  if (!recommendations || recommendations.length === 0) {
    container.innerHTML = "<p>No recommendations found.</p>";
    return;
  }

  const list = document.createElement("ul");
  recommendations.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  container.innerHTML = "<h3>Product Recommendations:</h3>";
  container.appendChild(list);
}
