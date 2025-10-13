Market Data Feed V3
The Market Stream Feed V3 provides real-time market updates, including the latest trading price, close price, open price, and more, through a WebSocket connection. The feed utilizes Protobuf encoding, which requires decoding messages using the provided Market Data V3 Proto file.

With the V3 version, significant enhancements have been introduced, offering improved stability, performance, and reliability for uninterrupted data delivery. This version also includes limitations on connections and subscriptions to ensure a stable and efficient data transmission process. These limitations are designed to optimize performance and maintain consistent feed quality.

To connect to the WebSocket endpoint, use the wss: protocol. Ensure that your WebSocket client is configured to handle automatic redirection to the authorized endpoint after authentication. For example, in a Node.js client, enabling the followRedirects setting facilitates seamless handling of redirection.

Once connected, you can subscribe to the required instrumentKeys by specifying the method and mode based on your needs. Ensure that the subscription request adheres to the V3 format. Incoming data from the feed must be decoded using Protobuf and the provided .proto file, properly adapted to your programming language for compatibility. The following table lists the defined limits for the feeder, which must be adhered to for uninterrupted data streaming.

NOTE
The WebSocket request message should be sent in binary format, not as a text message.
Normal Connection and Subscription Limits
Limit Type	Category	Individual Limit	Combined Limit
Connection		2 connections per user	N/A
Subscription	LTPC	5000 instrument keys	2000 instrument keys
Option Greeks	3000 instrument keys	2000 instrument keys
Full	2000 instrument keys	1500 instrument keys
Connection and Subscription Limits under Upstox Plus 
Limit Type	Category	Individual Limit	Combined Limit
Connection		5 connections per user	N/A
Subscription	Full D30	50 instrument keys	1500 instrument keys
The Individual Limit refers to the maximum number of instrument keys allowed when a user subscribes to a single category. For instance, if a user subscribes only to 'LTPC', they can access up to 5000 instrument keys.

The Combined Limit applies when subscriptions cover multiple categories. For example, if the same user subscribes to both 'LTPC' and 'Option Greeks', the limit for each category is set to 2000 instrument keys. This structure ensures users can efficiently manage multiple data streams within system capacity constraints.


Header Parameters
Name	Required	Type	Description
Authorization	true	string	Requires the format Bearer access_token where access_token is obtained from the Token API.
Accept	true	string	Defines the content format the client expects, which should be set to */*.
Request structure
{
  "guid": "13syxu852ztodyqncwt0",
  "method": "sub",
  "data": {
    "mode": "full",
    "instrumentKeys": ["NSE_INDEX|Nifty Bank"]
  }
}

Field	Description
guid	Globally unique identifier for the request.
method	The method for the request. (Refer to the table below for possible values.)
mode	The mode for the request. (Refer to the table below for possible values.)
instrumentKeys	Instrument keys for which you want updates.
Method field values
Value	Description
sub	Default mode is ltpc unless specified by user.
change_mode	Instrument key is mandatory.
unsub	Unsubscribe instrument key/s with further updates.
Mode field values
Value	Description
ltpc	Contains only the latest trading price (LTP) and close price (CP) changes.
option_greeks	Contains only option greeks.
full	Includes LTPC, 5 market level quotes, extended feed metadata, and option greeks.
full_d30	Includes LTPC, 30 market level quotes, extended feed metadata, and option greeks.
Responses
302
This API does not provide a typical JSON response. Instead, upon successful authentication, it automatically redirects the client to the appropriate websocket endpoint where market updates can be received in real-time. Users are expected to handle data streams as per the websocket protocol once the redirection is complete.

The feeds are structured to ensure seamless data flow and synchronization.

The first tick provides the market status, giving the current state of various market segments to ensure synchronization.
The second tick delivers a snapshot of the current market data, offering the latest available information.
Subsequent ticks stream live, real-time updates, ensuring clients stay updated with the latest market activity.

Market Status
The market_info is the first message sent for all feeds. It provides the real-time status of various market segments, ensuring the client is aware of the current trading conditions before streaming data. This helps synchronize the client with active segments and prevents unnecessary data processing for inactive or closed segments.

{
  "type": "market_info",
  "currentTs": "1732775008661",
  "marketInfo": {
    "segmentStatus": {
      "NSE_COM": "NORMAL_OPEN",
      "NCD_FO": "NORMAL_OPEN",
      "NSE_FO": "NORMAL_OPEN",
      "BSE_EQ": "NORMAL_OPEN",
      "BCD_FO": "NORMAL_OPEN",
      "BSE_FO": "NORMAL_OPEN",
      "NSE_EQ": "NORMAL_OPEN",
      "MCX_FO": "NORMAL_OPEN",
      "MCX_INDEX": "NORMAL_OPEN",
      "NSE_INDEX": "NORMAL_OPEN",
      "BSE_INDEX": "NORMAL_OPEN"
    }
  }
}

Name	Type	Description
type	string	Identifies the message type as market_info.
currentTs	string	Timestamp indicating when the message was generated.
marketInfo	object	Contains details about the status of various market segments.
marketInfo.segmentStatus	object	Key-value pairs where the key is the market segment and the value is its current status (e.g., NORMAL_OPEN). Valid statuses are listed in the Market Status Appendix

Market Data Snapshot
The second tick provides a snapshot of the current market data, presenting the latest state of the market at the time of connection. This ensures the client starts with an accurate and up-to-date view of market conditions. The following is a sample object for LTPC.

{
  "type": "live_feed",
  "feeds": {
    "NSE_FO|45450": {
      "ltpc": {
        "ltp": 219.3,
        "ltt": "1740729552723",
        "ltq": "75",
        "cp": 494.05
      }
    }
  },
  "currentTs": "1740729566039"
}

Live Feed

LTPC
Option Greeks
Full
Full D30 (Plus)
{
  "type": "live_feed",
  "feeds": {
    "NSE_FO|45450": {
      "ltpc": {
        "ltp": 219.3,
        "ltt": "1740729552723",
        "ltq": "75",
        "cp": 494.05
      }
    }
  },
  "currentTs": "1740729566039"
}

Name	Type	Description
type	string	Present in live feed, indicating the nature of the data.
feeds	object	Includes updates for instrumentKeys requested.
ltpc	object	Details of LTP information
ltpc.ltp	number	Last traded price
ltpc.ltt	string	Last traded time (timestamp).
ltpc.ltq	string	Last traded quantity
ltpc.cp	number	Closed price
feeds.currentTs	number	Timestamp of the received tick
Heartbeat
If there is no data to stream over an open WebSocket connection, the API automatically sends a standard ping frame periodically to maintain the connection's aliveness. Most standard WebSocket client libraries across various programming languages handle this automatically by responding with a pong frame, requiring no manual intervention.



[{"weekly":false,"segment":"NCD_FO","name":"JPYINR","exchange":"NSE","expiry":1774636199000,"instrument_type":"CE","asset_symbol":"JPYINR","underlying_symbol":"JPYINR","instrument_key":"NCD_FO|14294","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14294","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"JPYINR 61 CE 27 MAR 26","strike_price":61.0,"qty_multiplier":1000.0},{"weekly":false,"segment":"NCD_FO","name":"JPYINR","exchange":"NSE","expiry":1774636199000,"instrument_type":"PE","asset_symbol":"JPYINR","underlying_symbol":"JPYINR","instrument_key":"NCD_FO|14295","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14295","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"JPYINR 61 PE 27 MAR 26","strike_price":61.0,"qty_multiplier":1000.0},{"segment":"NSE_EQ","name":"SDL RJ 7.49% 2035","exchange":"NSE","isin":"IN2920250163","instrument_type":"SG","instrument_key":"NSE_EQ|IN2920250163","lot_size":100,"freeze_quantity":100000.0,"exchange_token":"758718","tick_size":1.0,"trading_symbol":"749RJ35","qty_multiplier":1.0,"security_type":"NORMAL"},{"segment":"NSE_EQ","name":"SDL RJ 7.57% 2043","exchange":"NSE","isin":"IN2920250171","instrument_type":"SG","instrument_key":"NSE_EQ|IN2920250171","lot_size":100,"freeze_quantity":100000.0,"exchange_token":"758723","tick_size":1.0,"trading_symbol":"757RJ43","qty_multiplier":1.0,"security_type":"NORMAL"},{"weekly":false,"segment":"NCD_FO","name":"GBPINR","exchange":"NSE","expiry":1767032999000,"instrument_type":"PE","asset_symbol":"GBPINR","underlying_symbol":"GBPINR","instrument_key":"NCD_FO|14277","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14277","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"GBPINR 118.25 PE 29 DEC 25","strike_price":118.25,"qty_multiplier":1000.0},{"weekly":false,"segment":"NCD_FO","name":"GBPINR","exchange":"NSE","expiry":1767032999000,"instrument_type":"CE","asset_symbol":"GBPINR","underlying_symbol":"GBPINR","instrument_key":"NCD_FO|14274","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14274","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"GBPINR 118 CE 29 DEC 25","strike_price":118.0,"qty_multiplier":1000.0},{"weekly":false,"segment":"NCD_FO","name":"GBPINR","exchange":"NSE","expiry":1767032999000,"instrument_type":"PE","asset_symbol":"GBPINR","underlying_symbol":"GBPINR","instrument_key":"NCD_FO|14275","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14275","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"GBPINR 118 PE 29 DEC 25","strike_price":118.0,"qty_multiplier":1000.0},{"weekly":false,"segment":"NCD_FO","name":"GBPINR","exchange":"NSE","expiry":1767032999000,"instrument_type":"CE","asset_symbol":"GBPINR","underlying_symbol":"GBPINR","instrument_key":"NCD_FO|14276","lot_size":1,"freeze_quantity":10000.0,"exchange_token":"14276","minimum_lot":1,"tick_size":0.25,"asset_type":"CUR","underlying_type":"CUR","trading_symbol":"GBPINR 118.25 CE 29 DEC 25","strike_price":118.25,"qty_multiplier":1000.0},{"segment":"NSE_EQ","name":"SDL RJ 7.15% 2053","exchange":"NSE","isin":"IN2920250148","instrument_type":"SG","instrument_key":"NSE_EQ|IN2920250148","lot_size":100,"freeze_quantity":100000.0,"exchange_token":"757833","tick_size":1.0,"trading_symbol":"715RJ53","qty_multiplier":1.0,"security_type":"NORMAL"},{"segment":"NSE_EQ","name":"SDL RJ 7.17% 2052","exchange":"NSE","isin":"IN2920250155","instrument_type":"SG","instrument_key":"NSE_EQ|IN2920250155","lot_size":100,"freeze_quantity":100000.0,"exchange_token":"758197","tick_size":1.0,"trading_symbol":"717RJ52","qty_multiplier":1.0,"security_type":"NORMAL"},{"weekly":false,"segment":"NSE_FO","name":"BANKNIFTY","exchange":"NSE","expiry":1767119399000,"instrument_type":"CE","asset_symbol":"BANKNIFTY","underlying_symbol":"BANKNIFTY","instrument_key":"NSE_FO|50904","lot_size":35,"freeze_quantity":875.0,"exchange_token":"50904","minimum_lot":35,"asset_key":"NSE_INDEX|Nifty Bank","underlying_key":"NSE_INDEX|Nifty Bank","tick_size":5.0,"asset_type":"INDEX","underlying_type":"INDEX","trading_symbol":"BANKNIFTY 51200 CE 30 DEC 25","strike_price":51200.0,"qty_multiplier":1.0},{"weekly":false,"segment":"NSE_FO","name":"BANKNIFTY","exchange":"NSE","expiry":1767119399000,"instrument_type":"PE","asset_symbol":"BANKNIFTY","underlying_symbol":"BANKNIFTY","instrument_key":"NSE_FO|50905","lot_size":35,"freeze_quantity":875.0,"exchange_token":"50905","minimum_lot":35,"asset_key":"NSE_INDEX|Nifty Bank","underlying_key":"NSE_INDEX|Nifty Bank","tick_size":5.0,"asset_type":"INDEX","underlying_type":"INDEX","trading_symbol":"BANKNIFTY 51200 PE 30 DEC 25","strike_price":51200.0,"qty_multiplier":1.0},{"segment":"NSE_EQ","name":"ENVIRO INFRA ENGINEERS 