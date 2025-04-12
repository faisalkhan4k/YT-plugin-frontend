document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyze-btn");
  const outputDiv = document.getElementById("output");
  const API_KEY = "AIzaSyBmbEao-um6KfRTvCAcGIHx-pZDu1gPb_M"; // Replace with your actual API key
  const API_URL = "http://127.0.0.1:5000/";

  analyzeBtn.addEventListener("click", async () => {
    const url = document.getElementById("youtube-url").value;
    const youtubeRegex =
      /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (!match || !match[1]) {
      outputDiv.innerHTML = "<p>Invalid YouTube URL</p>";
      return;
    }

    const videoId = match[1];
    outputDiv.innerHTML = `<div class="section-title">YouTube Video ID</div><p>${videoId}</p><p>Fetching comments...</p>`;

    const comments = await fetchComments(videoId);
    if (comments.length === 0) {
      outputDiv.innerHTML += "<p>No comments found for this video.</p>";
      return;
    }

    outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Performing sentiment analysis...</p>`;
    const predictions = await getSentimentPredictions(comments);

    if (!predictions) {
      outputDiv.innerHTML += "<p>Sentiment analysis failed.</p>";
      return;
    }

    const sentimentCounts = { 1: 0, 0: 0, "-1": 0 };
    const sentimentData = [];
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

    const totalComments = comments.length;
    const uniqueCommenters = new Set(comments.map((c) => c.authorId)).size;
    const totalWords = comments.reduce(
      (sum, c) => sum + c.text.split(/\s+/).filter((w) => w.length > 0).length,
      0
    );
    const avgWordLength = (totalWords / totalComments).toFixed(2);
    const avgSentimentScore = (totalSentimentScore / totalComments).toFixed(2);
    const normalizedSentimentScore = (
      ((parseFloat(avgSentimentScore) + 1) / 2) *
      10
    ).toFixed(2);

    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Comment Analysis Summary</div>
        <div class="metrics-container">
          <div class="metric"><div class="metric-title">Total Comments</div><div class="metric-value">${totalComments}</div></div>
          <div class="metric"><div class="metric-title">Unique Commenters</div><div class="metric-value">${uniqueCommenters}</div></div>
          <div class="metric"><div class="metric-title">Avg Comment Length</div><div class="metric-value">${avgWordLength} words</div></div>
          <div class="metric"><div class="metric-title">Avg Sentiment Score</div><div class="metric-value">${normalizedSentimentScore}/10</div></div>
        </div>
      </div>
    `;

    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Sentiment Analysis Results</div>
        <p>See the pie chart below for sentiment distribution.</p>
        <div id="chart-container"></div>
      </div>
    `;
    await fetchAndDisplayChart(sentimentCounts);

    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Sentiment Trend Over Time</div>
        <div id="trend-graph-container"></div>
      </div>`;
    await fetchAndDisplayTrendGraph(sentimentData);

    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Comment Wordcloud</div>
        <div id="wordcloud-container"></div>
      </div>`;
    await fetchAndDisplayWordCloud(comments.map((c) => c.text));

    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Top 25 Comments with Sentiments</div>
        <ul class="comment-list">
          ${predictions
            .slice(0, 25)
            .map(
              (item, i) =>
                `<li class="comment-item"><span>${i + 1}. ${
                  item.comment
                }</span><br><span class="comment-sentiment">Sentiment: ${
                  item.sentiment
                }</span></li>`
            )
            .join("")}
        </ul>
      </div>
    `;

    const recommendations = await fetchProductRecommendations(
      comments,
      sentimentCounts
    );
    if (recommendations) {
      outputDiv.innerHTML += `
        <div class="section">
          <div class="section-title">Recommended Products</div>
          <div class="recommendations-container">${recommendations}</div>
        </div>`;
    } else {
      outputDiv.innerHTML += `<p>Failed to fetch product recommendations.</p>`;
    }
  });

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
            const snippet = item.snippet.topLevelComment.snippet;
            comments.push({
              text: snippet.textOriginal,
              timestamp: snippet.publishedAt,
              authorId: snippet.authorChannelId?.value || "Unknown",
            });
          });
        }
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
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
      return response.ok ? result : null;
    } catch (err) {
      console.error("Error:", err);
      outputDiv.innerHTML += "<p>Error fetching sentiment predictions.</p>";
      return null;
    }
  }

  async function fetchAndDisplayChart(sentimentCounts) {
    try {
      const res = await fetch(`${API_URL}/generate_chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_counts: sentimentCounts }),
      });
      const blob = await res.blob();
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      img.style.width = "70%";
      img.style.height = "70%";
      document.getElementById("chart-container").appendChild(img);
    } catch (err) {
      console.error("Chart error:", err);
    }
  }

  async function fetchAndDisplayWordCloud(comments) {
    try {
      const res = await fetch(`${API_URL}/generate_wordcloud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      const blob = await res.blob();
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      img.style.width = "100%";
      document.getElementById("wordcloud-container").appendChild(img);
    } catch (err) {
      console.error("Wordcloud error:", err);
    }
  }

  async function fetchAndDisplayTrendGraph(data) {
    try {
      const res = await fetch(`${API_URL}/generate_trend_graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_data: data }),
      });
      const blob = await res.blob();
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      img.style.width = "70%";
      img.style.height='70%';
      document.getElementById("trend-graph-container").appendChild(img);
    } catch (err) {
      console.error("Trend graph error:", err);
    }
  }

  async function fetchProductRecommendations(comments, sentimentCounts) {
    try {
      // Preprocess comments for word cloud
      const preprocessedComments = comments.map((comment) => comment.text);
      const wordcloudText = preprocessedComments.join(" ");

      // Prepare sentiment summary
      const sentimentSummary = {
        positive: sentimentCounts["1"],
        neutral: sentimentCounts["0"],
        negative: sentimentCounts["-1"],
      };

      // Fetch recommendations from DeepSeek
      const response = await fetch(`${API_URL}/get_recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: preprocessedComments }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch product recommendations");
      } else {
        console.log("working! able to fetch");
      }

      const result = await response.json();
      return result.recommendations;
    } catch (error) {
      console.error("Error fetching product recommendations:", error);
      return null;
    }
  }
});
