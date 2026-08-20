require "test_helper"

class ReadingProgressTest < ActiveSupport::TestCase
  setup do
    @user = users(:author)
    @book = books(:published_book)
    @chapter = chapters(:published_chapter)
  end

  test "valid reading progress" do
    progress = ReadingProgress.new(
      user: @user,
      book: @book,
      current_chapter: @chapter,
      percentage: 50,
      status: :reading,
      last_read_at: Time.current
    )
    assert progress.valid?
  end

  test "percentage must be between 0 and 100" do
    progress = ReadingProgress.new(user: @user, book: @book, percentage: -1)
    assert_not progress.valid?
    assert_includes progress.errors[:percentage], "must be greater than or equal to 0"

    progress.percentage = 101
    assert_not progress.valid?
    assert_includes progress.errors[:percentage], "must be less than or equal to 100"
  end

  test "valid percentages" do
    [0, 50, 100].each do |pct|
      progress = ReadingProgress.new(user: @user, book: @book, percentage: pct)
      assert progress.valid?, "Percentage #{pct} should be valid"
    end
  end

  test "enum statuses" do
    assert_equal 0, ReadingProgress.statuses[:reading]
    assert_equal 1, ReadingProgress.statuses[:completed]
    assert_equal 2, ReadingProgress.statuses[:paused]
  end

  test "active scope returns reading status ordered by last_read_at" do
    progress1 = reading_progresses(:one)
    progress2 = reading_progresses(:two)

    active = ReadingProgress.active
    assert_includes active, progress1
    assert_not_includes active, progress2
  end

  test "recalculate_percentage! updates percentage based on chapters" do
    progress = ReadingProgress.find_or_create_by!(user: @user, book: @book) do |rp|
      rp.current_chapter = @chapter
      rp.status = :reading
      rp.percentage = 0
    end

    progress.recalculate_percentage!
    progress.reload

    assert progress.percentage >= 0
    assert progress.percentage <= 100
  end

  test "recalculate_percentage! reaches 100% on last chapter" do
    total_chapters = @book.chapters.count
    last_chapter = @book.chapters.ordered.last

    progress = ReadingProgress.find_or_create_by!(user: @user, book: @book) do |rp|
      rp.current_chapter = last_chapter
      rp.status = :reading
      rp.percentage = 0
    end

    progress.recalculate_percentage!
    progress.reload

    assert_equal 100, progress.percentage
    assert_equal "completed", progress.status
  end
end
