json.extract! chapter, :id, :title, :content, :position, :word_count, :created_at, :updated_at
json.url book_chapter_url(chapter.book, chapter)
