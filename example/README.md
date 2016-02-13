## Example

node sample.js

1st run will illustrate the transform is taking place due to a forced delay in the
transform to make it simulate something doing a good deal of work.

subsequent runs will be virtually instant, as the transformaton has been cached,
and the transform function can be bypassed.

update the helloworld.js file to see that the transform once again takes place,
as the cache is considered stale at that point
