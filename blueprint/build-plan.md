# Build Plan

> One of the two planning docs you provide. Write it directly, develop it through  
> any AI conversation, or optionally run `/discovery`. Keep the items high-level  
> even when [`project-plan.md`](http://project-plan.md) is detailed; later `/feature` specs hold the depth  
> for each build item.

## MVP

- [ ] 1. **Grocery list management** - add, remove, and retrieve grocery list items through the service API
- [ ] 2. **Product catalog and normalization** - maintain canonical products and resolve common item names and aliases
- [ ] 3. **Inventory event tracking** - record structured household stock signals such as restocked, low, out, and still available
- [ ] 4. **Purchase and restock flow** - record purchased items, including completing all or part of the current grocery list
- [ ] 5. **Household profile** - store household composition and prediction preferences used when estimating consumption
- [ ] 6. **Inventory state estimation** - derive likely product availability from inventory events, purchases, and elapsed time
- [ ] 7. **Consumption pattern learning** - calculate product-specific purchase and need intervals from household history
- [ ] 8. **LLM-assisted product understanding** - use structured LLM inference to classify and enrich products when deterministic data is insufficient
- [ ] 9. **Hybrid low-stock prediction** - combine household history, product characteristics, deterministic signals, and LLM reasoning into confidence-scored stock predictions
- [ ] 10. **Prediction feedback** - record accepted, rejected, and corrected predictions so future estimates can improve
- [ ] 11. **Low-stock recommendations** - expose actionable high-confidence suggestions while suppressing uncertain or unnecessary recommendations
- [ ] 12. **MCP tool interface** - expose the inventory service's core grocery, stock, purchase, and prediction capabilities as agent-callable tools
- [ ] 13. **Hermes inventory skill** - teach Hermes to map natural-language household requests to the appropriate inventory tools
- [ ] 14. **Hermes grocery conversations** - support natural WhatsApp flows such as "add milk", "what do we need?", and "I bought everything except toilet paper"
- [ ] 15. **Proactive stock checks** - let Hermes periodically request low-stock predictions and send useful recommendations through WhatsApp
- [ ] 16. **Service authentication** - protect REST and MCP access with private service-to-service authentication
- [ ] 17. **Operational visibility** - expose health checks and structured logs for inventory actions, predictions, and integration failures
- [ ] 18. **Deployment readiness** - containerize the NestJS service, configure PostgreSQL migrations and environment variables, and verify the production deployment

## Post-MVP

- [ ] 19. **Expiration tracking** - record expiration information and surface products likely to expire soon
- [ ] 20. **Storage locations** - track products across locations such as fridge, freezer, pantry, and storage room
- [ ] 21. **Product-specific automation policies** - allow selected products to be suggested, ignored, or automatically added based on prediction confidence
- [ ] 22. **Advanced prediction engine** - improve forecasting with richer statistical models and introduce a Python prediction service only if justified
- [ ] 23. **Background job infrastructure** - add Redis and a job queue when asynchronous or distributed prediction workloads require them
- [ ] 24. **Receipt and barcode ingestion** - use receipts or barcode scans as additional purchase and inventory signals
- [ ] 25. **Home Assistant integration** - expose grocery, inventory, and low-stock state to the household automation environment
- [ ] 26. **Management dashboard** - add a web interface for reviewing inventory state, predictions, history, and manual corrections if conversational control proves insufficient

