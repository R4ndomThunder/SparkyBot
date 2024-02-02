const { ChannelType } = require("discord.js");
const axios = require("axios");

module.exports = async (message, client) => {
  if (
    message.channel.type !== ChannelType.DM &&
    !message.content.startsWith("?ai")
  )
    return;
  if (message.author.bot) return;

  message.content = message.content.replace("?ai ", "");
  console.log("Requesting NVIDIA LLAMA: " + message.content);

  const invokeUrl =
    "https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/0e349b44-440a-44e1-93e9-abe8dcb27158";

  const headers = {
    Authorization: "Bearer " + process.env.LLAMA_KEY,
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };

  const payload = {
    messages: [
      {
        content: message.content,
        role: "user",
      },
    ],
    temperature: 0.2,
    top_p: 0.7,
    max_tokens: 1024,
    seed: 42,
    stream: true,
  };

  axios
    .post(invokeUrl, payload, { headers, responseType: "stream" })
    .then(async (response) => {
      respMessage = "";
      response.data.on("data", (chunk) => {
        try {
          let res = chunk.toString("utf-8");
          let jsonData = res.replace("data: ", "");
          const parsed = JSON.parse(jsonData);

          respMessage += parsed.choices[0].delta.content;

          if (parsed.choices[0].finish_reason == "stop") {
            message.channel.send(respMessage);
          }
        } catch (err) {
          console.log(err);
        }
      });
    })
    .catch((error) => {
      console.error("Error making request:", error.message);
    });
};