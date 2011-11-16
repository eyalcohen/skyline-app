# Skyline Data Storage Format #


## Concepts ##

### Samples ###

The fundamental unit of data in Skyline is the sample, which represents some value over some period of time. Rather than simply including a timestamp for each sample, we store a time range - this has many uses. It gives the consumer of the data an idea of the sampling frequency, it allows easy storage of state that’s spread out over time (for example, "turn signal on from 5:52:06.2 to 5:52:54.7"), and it enables our multi-resolution scheme described below.

Samples have a begin time, an end time, and a value. Here's an example sample:

    { beg: 1301965265123456,  // UTC 2011/04/05 01:01:04.123456.
      end: 1301965265133456,  // beg + 10ms.
      val: 12.3,  // Can be an object for special channels.
    }

Note that all times are stored in integer microseconds since 1970, UTC. Unfortunately this is in conflict with the Java and Javascript conventions of using milliseconds since 1970 UTC, but events on vehicles sometimes require better than 1ms granularity to represent. Note that times can be represented exactly with either 64-bit integers or 64-bit doubles, at least until the year 2255 (2<sup>53</sup>). For time ranges, the begin time is always inclusive and the end time is exclusive.

_(Idea: perhaps it would be better to use milliseconds since 1970, but allow floating point values?  Or even floating point seconds since 1970?  I worry about floating point inexactness, particularly when trying to compare values.)_

### Channels ###

A channel stores a time series of samples. Each channel has a unique textual name. Here are some examples:

* '`pm/precharged`'<br>
  Packmon subsystem, unitless quantity (true/false, in this case).
* '`bms/3/ltc.cellVoltage.1_V`'<br>
  Cell voltage of of cell 1 from the LTC chip of BMS 3, in units of volts.
* '`mc/motorTorque_Nm`'<br>
  Motor controller motor torque, in Newton * meters.
* '`vc/accel.x_m_s2`'<br>
  X-axis acceleration from vehicle computer, in meters/second<sup>2</sup>.

Channel names may be any string, but traditionally start with one or more subsystem identifiers separated by slashes or dots, a camelCase string that describes the data collected, followed by units.

Channel names which start with an underscore are reserved for internal use.

### Vehicles ###

Data is aggregated by vehicle. _(Perhaps we should rename this something more generic?)_ Each vehicle has a 32-bit id.


## Architecture ##

The data is stored in a [MongoDb](http://www.mongodb.org/) database, in a relatively compact but complicated format. A node module `SampleDb` provides access ot the samples portion of the database, presenting data as samples. A node server `service` provides database APIs to web clients and `puppet`-based uploaders, making use of `SampleDb`.

As data is added to the database, `SampleDb` automatically maintains a multi-resolution representation of the data, so that lower-resolution samples can be fetched efficiently.


### SampleDb API ###

`SampleDb` abstracts away the complexity of the underlying data store, presenting an API for easily querying the data or inserting new data.

#### fetchSamples ####

The main API for querying samples is the `fetchSamples` call. It accepts the following options:

* `vehicleId`: 32-bit ID of the vehicle.
* `channelName`: string name of the channel to fetch.
* `beginTime`, `endTime`: time range to fetch. Both arguments are optional, and default to the beginning of all time and the end of all time, respectively.
* `minDuration`: a duration in microseconds - samples of approximately this duration will be returned, as explained below.
* `getMinMax`: if `true`, and synthetic samples are returned (explained below), they will include `min` and `max` fields.

If `minDuration` is 0, then `fetchSamples` fetches "real" samples - all samples, as they were inserted into the database.

If `minDuration` is greater than 0, `fetchSamples` will merge real and synthetic samples to produce resulting samples, producing a series of samples of approximately the requested minDuration (or larger) which look good, but don't require a large amount of memory/bandwidth. It will pick a synthetic duration smaller than or equal to `minDuration` (see [Database Representation](#database-details) section below for details of synthetic durations and bucket thresholds). It will pick a bucket threshold smaller than the synthetic duration to use as an actual minimum duration. `fetchSamples` will then fetch real samples of duration equal to or greater than the actual minimum duration and synthetic samples of durations greater than the actual minimum duration, then merge the two, using real samples where available, and synthetic otherwise. Due to implementation details _(could be fixed)_, if `minDuration` > 0, then `beginTime` and `endTime` must be provided, and cover a time range which is not huge compared to `minDuration`.

A few examples might be helpful. Suppose the following samples have been inserted in the database for vehicleId 123, channel '`foo`':

    { beg: 10250, end: 10500, val: 1.0 }
    { beg: 10500, end: 10750, val: 2.0 }
    { beg: 10750, end: 12000, val: 3.0 }
    { beg: 12000, end: 13000, val: 4.0 }
    { beg: 13000, end: 15000, val: 5.0 }
    { beg: 17000, end: 19000, val: 6.0 }
    { beg: 20000, end: 35000, val: 7.0 }

A call of `fetchSamples(123, 'foo', { minDuration: 0 })` will return all samples above.

A call of `fetchSamples(123, 'foo', { beginTime: 10999, endTime: 16000, minDuration: 0 })` will return samples overlapping the provided time range:

    { beg: 10750, end: 12000, val: 3.0 }
    { beg: 12000, end: 13000, val: 4.0 }
    { beg: 13000, end: 15000, val: 5.0 }

A call of `fetchSamples(123, 'foo', { beginTime: 10000, endTime: 40000, getMinMax: true, minDuration: 1234 })` will fetch synthetic samples of duration 1000, real samples of duration >= 500, and combine them to return:

    { beg: 10000, end: 10750, val: 1.5, min: 1.0, max: 2.0 }
    { beg: 10750, end: 12000, val: 3.0 }
    { beg: 12000, end: 13000, val: 4.0 }
    { beg: 13000, end: 15000, val: 5.0 }
    { beg: 17000, end: 19000, val: 6.0 }
    { beg: 20000, end: 35000, val: 7.0 }

A call of `fetchSamples(123, 'foo', { beginTime: 10000, endTime: 40000, getMinMax: true, minDuration: 12345 })` will fetch synthetic samples of duration 10000, real samples of duration >= 5000, and combine them to return:

    { beg: 10000, end: 20000, val: 4.51851851851851851852, min: 1.0, max: 6.0 }
    { beg: 20000, end: 35000, val: 7.0 }

#### Schema Channel ####

#### Notification Channels ####

### <a name="database-details"></a>Database Details ###

The data is stored in a [MongoDb](http://www.mongodb.org/) database named '`service-samples`', in a variety of collections.

Clients need to be able to quickly query values over a particular time range -- to plot a graph, for example. Often a client will not want data at the sampled resolution - for example, if displaying a graph of data over one hour, a sample every millisecond is excessive. The client API allows clients to specify the resolution they would like, which is generated by averaging higher-resolution samples together. To accommodate this efficiently, pre-averaged samples are stored in the database to allow the server to return the lower-resolution samples without reading an excessive amount of data.

#### Users ####

#### Vehicles ####

#### Real Samples ####

Raw samples are stored in 'real' sample collections in the database. Each real sample collection stores samples with a particular range of durations - for example, samples collected on a microsecond basis are stored in a different slice than samples collected on a minutely basis. A real collection is named `real_N`, where N describes the number of microseconds of the smallest duration which can be contained in the collection. Exactly how the durations are broken up is an efficiency tradeoff. Below are the current collections:

* `real_0`: duration &lt; 500us
* `real_500`: 500us &lt;= duration &lt; 5ms
* `real_5000`: 5ms &lt;= duration &lt; 50ms
* `real_50000`: 50ms &lt;= duration &lt; 500ms
* `real_500000`: 500ms &lt;= duration &lt; 5s
* `real_5000000`: 5s &lt;= duration &lt; 30s
* `real_30000000`: 30s &lt;= duration &lt; 5m
* `real_300000000`: 5m &lt;= duration &lt; 30m
* `real_1800000000`: 30m &lt;= duration &lt; 6h
* `real_21600000000`: 6h &lt;= duration

For efficiency each row can contain multiple samples. Conceptually, each collection is divided up into buckets. The bucket size is the collection's minimum duration times 100, except `real_0`, which has a bucket size of 500us. The bucket number which each sample belongs to is defined as the sample beginTime (in us) divided by the bucket size, rounded down. All samples which are inserted at the same time and belong to the same bucket are inserted as a single row in the database.

For example, a sample with a beginTime of 1,320,192,797,376,000 and endTime of 1,320,192,809,791,000 has a duration of 12,415,000 = 12.415 seconds, and thus belongs in the `real_5000000` collection. This collection has a bucket size of 5s * 100 = 500,000,000. Our sample belongs in bucket floor(1320192797376000 / 500000000) = 2,640,385.

Each row in a `real_N` collection contains the following fields:

* `_id`: automatically-generated mongodb id
* `veh`: vehicle ID
* `chn`: channel name
* `buk`: bucket number of begin time of contained samples
* `beg`: delta-encoded array of begin times
* `end`: delta-encoded array of end times
* `val`: array of values

To delta-encode an array, replace each element except the first with the difference between that element and the previous element. Delta-encoding allows many times to be stored as 32-bit values rather than 64-bit values, saving some space in the database.

As an example, the following samples:

    { beg: 1320192797376000, end: 1320192809791000, val: 333.333 }
    { beg: 1320192812376000, end: 1320192818976000, val: -42.42 }
    { beg: 1320192822376000, end: 1320192825709333, val: 0 }

could be encoded into a single database row in `real_5000000`:

* `_id`: ObjectId("4ea836f81d0e5b28ae0000b9")
* `veh`: 123
* `chn`: "foo.bar"
* `buk`: 2640385
* `beg`: \[ 1320192797376000, 15000000, 10000000 \]
* `end`: \[ 1320192809791000, 9185000, 6733333 \]
* `val`: \[ 333.333, -42.42, 0 \]

Note that, because each real sample collection's bucket size is larger than the longest duration sample which can be stored in that collection, every sample in that collection can overlap at most two buckets.  The exception is the longest-duration collection `real_21600000000` - because it can store samples of arbitrary length, samples in that collection can overlap an arbitrary number of buckets, so rather than combining samples into buckets, each sample is stored as a separate row, with its `buk` field containing an array with all bucket numbers which the sample overlaps. For example, this three month long sample:

    { beg: 158400000000000, end: 166172400000000, val: 2 }

would be stored as a single database row in `real_21600000000`, which has bucket size 2,160,000,000,000 (6h):

* `_id`: ObjectId("4ea836f91d0e5b28ae000348")
* `veh`: 123
* `chn`: "big/bang"
* `buk`: \[ 73, 74, 75, 76 \]
* `beg`: 158400000000000
* `end`: 166172400000000
* `val`: 2

#### Synthetic Samples ####

In order to make it efficient to query data at a lower resolution, samples are averaged into synthetic samples.  Synthetic samples occur on a regular basis at particular resolutions, and include average, max, and min of real samples which overlap that time period.  Synthetic samples are stored in a number of synthetic collections:

* `syn_100`: duration is 100us
* `syn_1000`: duration is 1ms
* `syn_10000`: duration is 10ms
* `syn_100000`: duration is 100ms
* `syn_1000000`: duration is 1s
* `syn_10000000`: duration is 10s
* `syn_60000000`: duration is 1m
* `syn_600000000`: duration is 10m
* `syn_3600000000`: duration is 1h
* `syn_86400000000`: duration is 1d

Each sample's begin time is a multiple of its duration. For efficiency, synthetic samples are grouped together into rows - 50 synthetic samples per database row. Whenever a real sample which has a numerical value is inserted into the database, all sufficiently larger synthetic samples which overlap the real sample are updated. "Sufficiently large" is larger than the first larger real collection duration. Each row in a `syn_N` collection contains the following fields:

* `_id`: automatically-generated mongodb id
* `veh`: vehicle ID
* `chn`: channel name
* `buk`: the row of the contained synthetic samples, defined as the begin time of the first sample divided by the synthetic duration divided by 50
* `sum`: 50-long array of sample sums
* `ovr`: 50-long array of sample overlaps
* `min`: 50-long array of sample minima
* `max`: 50-long array of sample maxima

The `sum`, `ovr`, `min`, and `max` arrays each contain one element for each synthetic sample, in order. Thus array element [N] describe the synthetic sample whose begin time is (N + buk * 50) * (synthetic duration). For synthetic samples with no data, the array elements contain `null` or `undefined`.  Each `ovr` element contains the total amount of time that real samples overlap the corresponding synthetic sample, while each `sum` element contains the sum of each real sample's value times the amount that real sample overlaps the corresponding synthetic sample.  By dividing `sum` elements by `ovr` element, weighted mean values can be obtained.

An example might be helpful. Consider these real samples:

* `{ beg: 1320258752500000, end: 1320258752900000, val: 12 }`<br>
  Since duration is 400ms, contributes to all synthetic collections &gt; 500ms.<br>
  In `syn_1000000`, overlaps samples:<br>
  &nbsp;&nbsp;[1320258752000000, 1320258753000000) by 400ms.
* `{ beg: 1320258752900000, end: 1320258753200000, val: -5 }`<br>
  Since duration is 300ms, contributes to all synthetic collections &gt; 500ms.<br>
  In `syn_1000000`, overlaps samples:<br>
  &nbsp;&nbsp;[1320258752000000, 1320258753000000) by 100ms;<br>
  &nbsp;&nbsp;[1320258753000000, 1320258754000000) by 200ms.

If real samples are inserted into the database, and there are no other samples nearby which might contribute, the following row will be created in the `syn_1000000` collection:

* `_id`: ObjectId("4eb18d47cfa4d3c91b46e0f0")
* `veh`: 123
* `chn`: "synExample"
* `buk`: 26405175
* `sum`: \[ null, null, 12 * 400000 + -5 * 100000, -5 * 200000, null, null, ... \]
* &nbsp;&nbsp;`sum`: \[ null, null, 4300000, -1000000, null, null, ... \]
* `ovr`: \[ null, null, 400000 + 100000, 200000, null, null, ... \]
* &nbsp;&nbsp;`ovr`: \[ null, null, 500000, 200000, null, null, ... \]
* `min`: \[ null, null, -5, -5, null, null, ... \]
* `max`: \[ null, null, 12, -5, null, null, ... \]

If 1s synthetic samples are fetched, the following samples would be returned based on the row above:

    { beg: (2 + 26405175 * 50) * 1000000, end: (3 + 26405175 * 50), val: 4300000 / 500000, min: -5, max: 12 }
    { beg: (3 + 26405175 * 50) * 1000000, end: (4 + 26405175 * 50), val: -1000000 / 200000, min: -5, max: -5 }

Doing the math, this becomes:

    { beg: 1320258752000000, end: 1320258753000000, val: 8.6, min: -5, max: 12 }
    { beg: 1320258753000000, end: 1320258754000000, val: -5, min: -5, max: -5 }

#### Fetching Samples ####

When fetching samples from the database, we want to ensure that we retrieve all samples relevant to the requested time range and minDuration.  If minDuration is greater than zero, we'll have to fetch real and synthetic samples, and then combine them to form a set of samples in which the minimum duration is roughly the requested duration.

##### fetchRealSamples #####

In order to fetch real samples, we find the largest real sample collection whose minimum duration is &lt;= minDuration, and we issue queries in parallel to all real sample collections of that size and larger.  The queries consist of:

* `veh`: requested vehicle ID
* `chn`: requested channel name
* `buk`: range query

The bucket range queried for is a bit tricky. For the largest real collection, since each sample has a list of all buckets it overlaps, we simply query for floor(`beginTime` / `bucketSize`) &lt;= buk &lt; ceil(`endTime` / `bucketSize`).  For all other real collections, since we only calculate the bucket number based on each sample's begin time, we might have to reduce the minimum bucket by one. The query range becomes floor((`beginTime` - `nextRealSize`) / `bucketSize`) &lt;= buk &lt; ceil(`endTime` / `bucketSize`), where `nextRealSize` is the minimum duration of the next larger real collection.

The results of the queries are decoded into samples (undoing the delta encoding), samples which don't overlap the requested time range are filtered out, and sorted by time into a single list of samples.

##### fetchMergedSamples #####

When fetching samples where there might be synthetic samples contributing to the result, we modify the minDuration to be the largest synthetic duration &lt;= the given minDuration.  In parallel, we fetch real samples using `fetchRealSamples`, and we fetch synthetic samples.

We fetch synthetic samples by issuing a query to the sythetic sample collection whose duration is the found largest synthetic duration &lt;= the given minDuration:

* `veh`: requested vehicle ID
* `chn`: requested channel name
* `buk`: floor(`beginTime` / `syntheticDuration` / 50) &lt;= `buk` &lt; ceil(`endTime` / `syntheticDuration` / 50)

The returned rows are expanded into synthetic samples as described above, and samples which don't overlap the requested time range are filtered out.

We merge the real and synthetic samples by going through the real samples, and for every gap between consecutive samples (or between beginTime and the first sample or the last sample and endTime), trying to fill that gap with any synthetic samples.

#### Inserting Samples ####

Inserting new samples is a relatively complex operation - it requires possibly merging samples, inserting real samples, and inserting synthetic samples.

When inserting samples, if there is a schema element for a given channel whose `merge` attribute is true, or for the `_schema` channel, adjacent and overlapping samples with identical values are merged. This is a tricky operation, since it might require a database query to identify existing samples which need to be merged, and might require deleting samples from the database after the merge. The sequence of operations is:

* In function `SampleDb.prototype.queryForMerge`:
  * Fetch all real samples which might overlap the samples we're adding.
  * Tag the fetched samples.
  * Merge the fetched samples with the samples we're adding, and sort the resulting array by time.
  * In function `mergeOverlappingSamples2`: merge overlapping samples, returning database samples which have been made redundant, and ensuring that new merged samples aren't tagged.
  * Filter out tagged samples, so that we'll only add the new and merged samples to the database.
* Insert the new and merged samples.
* After all inserts are complete, delete the samples which have been made redundant using `SampleDb.prototype.deleteRedundantRealSample`:
  * Find all rows which might contain the real sample; for each:
    * If the row only contains a single sample, and that sample matches the redundant sample, delete the row.
    * If the row contains multiple samples, delete the element of the `val` array which corresponds to the redundant sample, using MongoDb's [$unset](http://www.mongodb.org/display/DOCS/Updating#Updating-%24unset) operator to ensure that the operation occurs atomically.

The bulk of the insert operation consists of:

* Organize samples into rows - for each sample:
  * Determine which real sample collection and row it will go into.
  * Determine which synthetic collection rows it will go into, and aggregate `sum`/`ovr`/`min`/`max` for those rows.
* Insert rows into real collections - for each new row:
  * Execute an insert operation, creating the new row in the appropriate collection.
* Update synthetic rows in synthetic collections. This is really tricky to do in a way that works correctly even if multiple clients are updating the database simultaneously. For each synthetic row:
  1. Execute a [findAndModify](http://www.mongodb.org/display/DOCS/findAndModify+Command) upsert to find and return the appropriate synthetic row; if it doesn't exist, it is created with empty `sum`/`ovr`/`min`/`max` arrays. Call the returned row `original`.
  2. Create a new object `modified` which consists of `original` combined with the new synthetic data.
  3. Execute another findAndModify, querying for `original` and replacing it with `modified`.
  4. If the findAndModify return an object, then it succeeded and we're done. If it returned null, then the synthetic row was changed by another process after we fetched its original value, so go back to step 1.
  * _(Note: this process could use a single atomic upsert and thus be much more efficient if MongoDb had [$min/$max update operators](https://jira.mongodb.org/browse/SERVER-1534) and [$iset update operator](https://jira.mongodb.org/browse/SERVER-340).)_

## Things to Document ##

Schema.
Notifications.
Mergable channels.

## Future Improvements/Ideas ##

What does inserting overlapping samples mean?

How does the client upload higher-resolution data when available?

### Optimized Schema ###

* Passing `{ autoIndexId: false }` to `createCollection` allows creating a collection without an index on `_id`, which could save a lot of space, and no longer require unique IDs.
* Alternately, `_id` could contain `[ vehicleId, channelName, bucket ]`.
* Idea to require a single lookup per request:
  * All real samples should get synthetic samples, even real-samples with non-numeric samples.  For such samples, the synthetic sample values would simply indicate that real samples exist overlapping the corresponding time range.
  * Client sample cache would know to only request higher-resolution samples in buckets that overlap a lower-resolution synthetic sample.
  * Server would track which buckets the client has visible and cached, and send updates for visible buckets which the client doesn't have cached or which have changed, and cache invalidation requests for buckets which the client has cached and have changed.
  * For locality, store multiple buckets in a single document, and store real and synthetic samples in same document.  Can retreive a portion of an array from a request: `foo: { $slice: [10, 5] }`.
  * Keep a capped log of buckets which have had data updates.  This can be used for client cache invalidation, with a tailable cursor.
* Could store begin and end arrays relative to bucket start time.
* Could make a begin time of null mean "same as previous end time".
* Could intern channel names, store them as 32-bit numbers.
