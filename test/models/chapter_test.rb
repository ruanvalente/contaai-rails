require "test_helper"

class ChapterTest < ActiveSupport::TestCase
  test "requires a title" do
    chapter = Chapter.new(book: books(:draft_book), title: "", content: "<p>x</p>")
    assert_not chapter.valid?
    assert chapter.errors.added?(:title, :blank)
  end

  test "rejects a negative position" do
    chapter = books(:draft_book).chapters.build(title: "X", content: "<p>x</p>", position: -1)
    assert_not chapter.valid?
    assert_includes chapter.errors[:position], "must be greater than or equal to 0"
  end

  test "default position is the current maximum plus one" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Novo", content: "<p>x</p>")
    assert_equal 2, chapter.position
  end

  test "recalculates word_count and character_count from content" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Teste", content: "<h1>Olá</h1><p>mundo <strong>legal</strong></p>")
    assert_equal 3, chapter.word_count
    assert_equal 15, chapter.character_count
  end

  test "empty content produces zero counts" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Vazio", content: "<p></p>")
    assert_equal 0, chapter.word_count
    assert_equal 0, chapter.character_count
  end

  test "removes script tags from content without inflating counts" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "XSS", content: "<script></script><p>ola</p>")
    refute_match(/<script/i, chapter.content)
    assert_equal 1, chapter.word_count
    assert_equal 3, chapter.character_count
  end

  test "removes javascript from link urls" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Link", content: %(<a href="javascript:alert(1)">clique</a><p>ok</p>))
    assert_not chapter.content.include?("javascript:")
  end

  test "removes img tags" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Img", content: %(<img src="x" onerror="alert(1)"><p>ok</p>))
    assert_not chapter.content.include?("<img")
  end

  test "preserves allowed tags and attributes" do
    book = books(:draft_book)
    content = %(<h2>Título</h2><p>texto <strong>negrito</strong> <em>itálico</em> <u>sub</u> <a href="https://x.com" rel="nofollow">link</a></p>)
    chapter = book.chapters.create!(title: "Permitidos", content: content)
    assert_includes chapter.content, "<h2>Título</h2>"
    assert_includes chapter.content, "<strong>negrito</strong>"
    assert_includes chapter.content, "<em>itálico</em>"
    assert_includes chapter.content, "<u>sub</u>"
    assert_includes chapter.content, 'href="https://x.com"'
  end

  test "updates the book word_count when a chapter is saved" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Novo", content: "<p>um dois tres</p>")
    book.reload
    assert_equal book.chapters.sum(:word_count), book.word_count
    assert_equal 3, chapter.word_count
  end

  test "updates the book word_count when a chapter is destroyed" do
    book = books(:draft_book)
    chapter = book.chapters.create!(title: "Temporário", content: "<p>um dois</p>")
    before = book.word_count
    chapter.destroy
    book.reload
    assert_equal before - 2, book.word_count
  end
end
