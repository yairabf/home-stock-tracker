import { All, Controller, NotFoundException, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { McpServerFactory } from './mcp-server.factory';

@Controller('mcp')
export class McpController {
  constructor(private readonly serverFactory: McpServerFactory) {}

  @All()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (process.env.MCP_ENABLED !== 'true') {
      throw new NotFoundException();
    }

    const server = this.serverFactory.create();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } finally {
      await server.close();
    }
  }
}
