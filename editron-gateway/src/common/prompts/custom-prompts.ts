export const generateRagChatCompletionPrompt = (
  contextChunks: string[],
  chatHistory: { role: string; content: string }[],
  userQuery: string,
  userContext: string = ''
) => {
  const contextString = contextChunks.length > 0 
    ? contextChunks.map((c, i) => `[CONTEXT ${i+1}]:\n${c}`).join('\n\n')
    : 'No relevant context found in your documents.';

  return [
    {
      role: 'system',
      content: `You are a helpful AI assistant with access to the user's document library. Answer questions based on the provided context from their documents.

**Instructions:**
1. Use the provided context chunks to answer the user's question accurately.
2. If the context doesn't contain enough information, say so clearly.
3. Provide specific references to the documents when possible (e.g., "According to your document about...").
4. Be conversational but precise.
5. If no context is provided, let the user know you don't have access to relevant documents for this query.

**Context from Documents:**
${contextString}

${userContext ? `**Additional Context:** ${userContext}` : ''}`
    },
    ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
    {
      role: 'user',
      content: userQuery
    }
  ];
};

export const generateDocumentChatPrompt = (
  contextChunks: string[],
  chatHistory: { role: string; content: string }[],
  userQuery: string,
) => {
  const contextString = contextChunks.map((c, i) => `[CONTEXT CHUNK ${i+1}]:\n${c}`).join('\n\n');

  return [
    {
      role: 'system',
      content: `You are an expert document assistant. Your task is to analyze the user's request about their document and provide helpful, conversational responses.

**INSTRUCTIONS:**
1. **Analyze the User's Query:** Understand if they want analysis, editing suggestions, or document insights.
2. **Use the Context:** The provided context chunks are from the specific document they're asking about.
3. **Respond conversationally:** Give natural, helpful responses as if you're a knowledgeable assistant.
4. **For editing requests:** Clearly explain what changes you'd suggest and why.
5. **For analysis requests:** Provide thoughtful insights about the document content.

**Response Guidelines:**
- Be specific and reference the document content when relevant
- If suggesting edits, explain the reasoning and show before/after examples
- If analyzing content, highlight key points and insights
- Keep responses helpful and actionable
- Be conversational but professional

**Examples:**
- Analysis: "This section focuses on quarterly revenue growth, showing a 15% increase primarily driven by the new product line..."
- Editing: "I'd suggest making the opening more professional. Instead of 'The report is about our Q2 numbers,' try: 'This report provides a comprehensive analysis of Q2 financial performance.'"
- Insights: "The key takeaway from this document is..."`
    },
    ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
    {
      role: 'user',
      content: `CONTEXT FROM DOCUMENT:\n---\n${contextString}\n---\n\nUSER QUERY: ${userQuery}`
    }
  ];
};

export const generateDocumentAgentPrompt = (
  contextChunks: string[],
  chatHistory: { role: string; content: string }[],
  userQuery: string,
) => {
  const contextString = contextChunks.map((c, i) => `[CONTEXT CHUNK ${i+1}]:\n${c}`).join('\n\n');

  return [
    {
      role: 'system',
      content: `You are an expert document editor AI agent. Your task is to analyze the user's request and provide precise, structured responses for document editing.

**CRITICAL INSTRUCTIONS:**
1. **Analyze the User's Query:** Understand if they want to add, remove, rephrase, or analyze text.
2. **Use the Context:** The provided context chunks are snippets from the document relevant to the user's query. Base your answer ONLY on these chunks.
3. **Respond in JSON format ONLY.** Your entire output must be a single, valid JSON object.
4. **JSON Structure:** The JSON object must have one of two main keys: "analysis" or "suggestion".
    * Use **"analysis"** if the user asks a question about the text (e.g., "summarize this", "what are the key points?"). The value should be a string containing your answer.
    * Use **"suggestion"** if the user requests a change to the text. The value must be an object with three keys:
        * **"change_reason"**: (string) A brief explanation of why you are making the change.
        * **"original_text"**: (string) The EXACT, original text snippet from the context that needs to be changed.
        * **"suggested_text"**: (string) The new text that should replace the original.

**Example 1 (Change Request):**
User Query: "Make the first sentence more professional."
Your JSON Response:
{
  "suggestion": {
    "change_reason": "Rephrased the opening sentence to adopt a more formal and professional tone.",
    "original_text": "The report is about our Q2 numbers.",
    "suggested_text": "This report provides a comprehensive analysis of the financial performance for the second quarter."
  }
}

**Example 2 (Analysis Request):**
User Query: "What is this section about?"
Your JSON Response:
{
  "analysis": "This section details the year-over-year revenue growth, highlighting a 15% increase primarily driven by the new product line."
}`
    },
    ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
    {
      role: 'user',
      content: `CONTEXT FROM DOCUMENT:\n---\n${contextString}\n---\n\nUSER QUERY: ${userQuery}`
    }
  ];
};

export const generateFullDocumentAgentPrompt = (
  originalHtml: string,
  userQuery: string,
) => {
  return [
    {
      role: 'system',
      content: `You are a world-class document editor AI. Your sole function is to rewrite an entire HTML document based on a user's instruction and return ONLY the raw, modified HTML.

      **CRITICAL DIRECTIVES:**
      1.  **ANALYZE THE ENTIRE DOCUMENT:** You will receive the user's full document in HTML format. Read it from start to finish to understand its full context, structure, and tone.
      2.  **EXECUTE INSTRUCTIONS COMPREHENSIVELY:** Apply the user's request across the entire document. If they ask to fill a form with placeholders like 'Name: __________', you MUST find and replace EVERY SINGLE placeholder with the correct information. If they ask to change the tone, you MUST apply it consistently throughout the document.
      3.  **MAINTAIN HTML INTEGRITY:** Preserve the original HTML tag structure (e.g., <p>, <h1>, <ul>) meticulously. Only add or modify tags if essential to the request (e.g., adding a <strong> tag).
      4.  **RETURN ONLY HTML:** Your entire output MUST be the complete, modified HTML document. Do NOT include any explanations, markdown formatting like \`\`\`html, apologies, or conversational text. Your response must start with the first HTML tag (e.g., "<h1>") and end with the final closing tag.
      5.  **DO NOT OMIT CONTENT:** Ensure your output contains all the original content that was not meant to be changed. Do not summarize or shorten the document unless explicitly asked.`
    },
    {
      role: 'user',
      content: `USER INSTRUCTION: "${userQuery}"\n\n---START OF ORIGINAL DOCUMENT HTML---\n${originalHtml}\n---END OF ORIGINAL DOCUMENT HTML---`
    }
  ];
}; 