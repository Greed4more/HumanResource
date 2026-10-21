-- Raise the per-photo limit from 5 MB to 15 MB. ID cards stay at 10 MB.
update storage.buckets
set file_size_limit = 15728640
where id = 'photos';
