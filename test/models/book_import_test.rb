# frozen_string_literal: true

require "test_helper"

class BookImportTest < ActiveSupport::TestCase
  test "belongs to book and user" do
    import = book_imports(:ready_import)

    assert_equal books(:draft_book), import.book
    assert_equal users(:author), import.user
  end

  test "validates filename presence" do
    import = BookImport.new(book: books(:draft_book), user: users(:author))

    refute import.valid?
    assert_not_nil import.errors[:filename]
  end

  test "status enum covers lifecycle" do
    assert_equal "pending", book_imports(:pending_import).status
    assert BookImport.statuses.key?(:failed)
  end

  test "parsed_chapters returns array from parsed_data" do
    assert_equal 2, book_imports(:ready_import).parsed_chapters.size
    assert_empty BookImport.new.parsed_chapters
  end

  test "needs_review? detects low confidence chapters" do
    assert book_imports(:ready_import).needs_review?
    refute book_imports(:confirmed_import).needs_review?
  end

  test "mark_ready! stores parsed chapters" do
    import = BookImport.create!(book: books(:draft_book), user: users(:author), filename: "x.txt")
    chapter = ChapterImporter::ChapterDetector::Chapter.new(
      title: "Capítulo 1", content: "<p>a</p>", confidence: 0.95
    )

    import.mark_ready!([ chapter ])

    assert import.ready?
    assert_equal 1, import.parsed_chapters.size
    assert_equal({ "title" => "Capítulo 1", "content" => "<p>a</p>", "confidence" => 0.95 }, import.parsed_chapters.first)
  end

  test "mark_failed! records error message" do
    import = BookImport.create!(book: books(:draft_book), user: users(:author), filename: "x.txt")

    import.mark_failed!("Formato não suportado.")

    assert import.failed?
    assert_equal "Formato não suportado.", import.error_message
  end
end
