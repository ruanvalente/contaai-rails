require "test_helper"

class BookTest < ActiveSupport::TestCase
  test "requires title, author name and category" do
    book = Book.new(user: users(:author), title: "", author_name: "", category: nil)
    assert_not book.valid?
    assert book.errors.added?(:title, :blank)
    assert book.errors.added?(:author_name, :blank)
    assert book.errors.added?(:category, :blank)
  end

  test "has_chapters? returns true when chapters exist" do
    assert books(:draft_book).has_chapters?
    assert_not books(:other_book).has_chapters?
  end

  test "publishable? is true when all requirements are met" do
    book = books(:draft_book)
    assert book.publishable?
  end

  test "publishable? is false without chapters" do
    book = books(:other_book)
    assert_not book.publishable?
  end

  test "publishable? is false without a title" do
    book = books(:draft_book)
    book.title = ""
    assert_not book.publishable?
  end

  test "publishable? is false without a category" do
    book = books(:draft_book)
    book.category = nil
    assert_not book.publishable?
  end

  test "sanitizes content on save" do
    book = books(:other_book)
    book.content = "<script>alert(1)</script><h2>Título</h2>"
    book.save!
    assert_not book.content.include?("script")
    assert_includes book.content, "<h2>Título</h2>"
  end

  test "publishable? is false without word_count" do
    book = books(:draft_book)
    book.chapters.update_all(word_count: 0)
    assert_not book.publishable?
  end

  test "enum categories are correct" do
    assert_equal 0, Book.categories[:fiction]
    assert_equal 1, Book.categories[:non_fiction]
    assert_equal 2, Book.categories[:poetry]
    assert_equal 3, Book.categories[:essay]
    assert_equal 4, Book.categories[:short_story]
    assert_equal 5, Book.categories[:other]
  end

  test "enum statuses are correct" do
    assert_equal 0, Book.statuses[:draft]
    assert_equal 1, Book.statuses[:published]
    assert_equal 2, Book.statuses[:archived]
  end

  test "published scope returns only published books" do
    assert_includes Book.published, books(:published_book)
    assert_not_includes Book.published, books(:draft_book)
  end

  test "book has many chapters" do
    book = books(:draft_book)
    assert_respond_to book, :chapters
    assert_equal 2, book.chapters.count
  end

  test "destroying book destroys chapters" do
    book = books(:draft_book)
    chapter_count = book.chapters.count
    assert_difference "Chapter.count", -chapter_count do
      book.destroy
    end
  end

  test "sanitizes javascript URLs in content" do
    book = books(:other_book)
    book.content = '<a href="javascript:alert(1)">click</a><p>safe</p>'
    book.save!
    refute_match(/javascript:/i, book.content)
    assert_includes book.content, "<p>safe</p>"
  end
end
