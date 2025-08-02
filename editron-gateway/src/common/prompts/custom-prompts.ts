export const generateRagChatCompletionPrompt = (
  contextChunks: string[],
  chatHistory: { role: string; content: string }[],
  userQuery: string,
  customInstructions?: string,
  projectInfo?: string,
) => {
  const contextString = contextChunks.length > 0
    ? contextChunks.map((c, i) => {
        // Parse the string format "[title]: content" to extract title and content
        const match = c.match(/^\[([^\]]+)\]:\s*(.*)$/s);
        const title = match ? match[1] : 'document';
        const content = match ? match[2] : c;
        return `<CHUNK source="${title}" index="${i + 1}">\n${content}\n</CHUNK>`;
      }).join('\n\n')
    : 'No relevant context was found in your documents for this query.';

  const instructionsContext = customInstructions ? `<PROJECT_INSTRUCTIONS>\n${customInstructions}\n</PROJECT_INSTRUCTIONS>` : '';
  const projectInfoContext = projectInfo ? `<PROJECT_INFO>\n${projectInfo}\n</PROJECT_INFO>` : '';

  const systemContent = `You are Editron, an expert AI research assistant. Your purpose is to help the user understand and synthesize information from their document library.

**Your Thought Process:**
1. **Analyze the User's Query:** Understand the core question or task.
2. **Consult Provided Context:** Scrutinize the <DOCUMENT_CONTEXT>, <PROJECT_INFO>, and <PROJECT_INSTRUCTIONS> sections. This is your primary source of truth.
3. **Synthesize Your Answer:** Formulate a concise, accurate, and helpful response based *only* on the provided information and chat history.
4. **Cite Your Sources:** When possible, mention which document or source your information comes from (e.g., "According to the 'Q3 Report.docx' document...").

**Rules:**
- If the provided context does not contain the answer, state that clearly. Do not invent information.
- Adhere strictly to any <PROJECT_INSTRUCTIONS>. They override your general behavior.
- Be professional, clear, and conversational.`;

  return [
    {
      role: 'system',
      content: systemContent,
    },
    ...chatHistory.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
    {
      role: 'user',
      content: `${projectInfoContext}
${instructionsContext}

<DOCUMENT_CONTEXT>
${contextString}
</DOCUMENT_CONTEXT>

<USER_QUERY>
${userQuery}
</USER_QUERY>`,
    },
  ];
};

export const generateDocumentChatPrompt = (
  contextChunks: string[],
  chatHistory: { role: string; content: string }[],
  userQuery: string,
  customInstructions?: string,
) => {
  const contextString = contextChunks.length > 0
    ? contextChunks.map((c, i) => {
        // Parse the string format "[title]: content" to extract content
        const match = c.match(/^\[([^\]]+)\]:\s*(.*)$/s);
        const content = match ? match[2] : c;
        return `<CHUNK index="${i + 1}">\n${content}\n</CHUNK>`;
      }).join('\n\n')
    : 'No relevant context is available for this part of the document.';

  const instructionsContext = customInstructions ? `<PROJECT_INSTRUCTIONS>\n${customInstructions}\n</PROJECT_INSTRUCTIONS>` : '';

  const systemContent = `You are Editron, an expert AI document specialist. Your purpose is to help the user analyze, understand, and improve the specific document they are currently viewing.

**Your Thought Process:**
1. **Analyze the User's Query:** Determine if the user is asking a question, seeking an explanation, or requesting an editing suggestion.
2. **Consult Document Context:** Use the provided <DOCUMENT_CONTEXT> chunks as your sole source of truth for the document's content.
3. **Formulate a Response:**
    - **For questions:** Answer directly and concisely based on the text.
    - **For analysis:** Provide insights, summarize key points, or explain complex sections.
    - **For edit suggestions:** Describe the suggested change conversationally and explain the reasoning. (e.g., "To make that sentence more impactful, you could try changing 'it was good' to 'it was a resounding success.' This adds a more confident tone.").

**Rules:**
- All responses must be conversational and helpful.
- Adhere strictly to any <PROJECT_INSTRUCTIONS>.
- Do not invent information not present in the context.`;

  return [
    {
      role: 'system',
      content: systemContent,
    },
    ...chatHistory.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
    {
      role: 'user',
      content: `${instructionsContext}

<DOCUMENT_CONTEXT>
${contextString}
</DOCUMENT_CONTEXT>

<USER_QUERY>
${userQuery}
</USER_QUERY>`,
    },
  ];
};

export const generateFullDocumentAgentPrompt = (
  originalHtml: string,
  userQuery: string,
  customInstructions?: string,
) => {
  const instructionsContext = customInstructions ? `<PROJECT_INSTRUCTIONS>\n${customInstructions}\n</PROJECT_INSTRUCTIONS>` : '';

  return [
    {
      role: 'system',
      content: `You are a document processing engine. Your only function is to receive an HTML document and a user instruction, and return a complete, modified HTML document. You do not speak or explain; you only transform.

**EXECUTION DIRECTIVES:**
1. **INPUT:** You will receive a <USER_INSTRUCTION>, optional <PROJECT_INSTRUCTIONS>, and the full <ORIGINAL_DOCUMENT_HTML>.
2. **TASK:** Apply the user's instruction comprehensively to the entire document. If the instruction is to fill placeholders (e.g., "Name: ______"), you MUST find and replace ALL such placeholders. If the instruction is to change the tone, you MUST apply it consistently.
3. **CONSTRAINT - HTML INTEGRITY:** Preserve the original HTML tag structure (e.g., <p>, <h1>, <ul>) meticulously. Do not add or remove block-level elements unless the instruction explicitly requires it.
4. **CONSTRAINT - NO OMISSION:** Your output must contain all original content that was not targeted by the user's instruction. Do not shorten or summarize the document.
5. **OUTPUT FORMAT:** Your entire response MUST be the raw, modified HTML document. It must start with the first HTML tag and end with the final closing tag. Do NOT include any other text, markdown, or explanations.

**EXAMPLE SCENARIO:**
<USER_INSTRUCTION>
Fill out the form with: Client is "Innovate Inc.", Date is "2024-09-15". Also, make the tone more formal.
</USER_INSTRUCTION>
<ORIGINAL_DOCUMENT_HTML>
<h1>Meeting Notes</h1><p>Client: _________. We think the project is going okay.</p><p>Date: __________</p>
</ORIGINAL_DOCUMENT_HTML>

**YOUR REQUIRED OUTPUT:**
<h1>Meeting Notes</h1><p>Client: Innovate Inc. The project is proceeding according to schedule and initial results are promising.</p><p>Date: 2024-09-15</p>`
    },
    {
      role: 'user',
      content: `${instructionsContext}

<USER_INSTRUCTION>
${userQuery}
</USER_INSTRUCTION>

<ORIGINAL_DOCUMENT_HTML>
${originalHtml}
</ORIGINAL_DOCUMENT_HTML>`,
    },
  ];
}; 