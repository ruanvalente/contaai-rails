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
end
