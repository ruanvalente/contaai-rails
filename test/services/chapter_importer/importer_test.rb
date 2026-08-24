# frozen_string_literal: true

require "test_helper"

module ChapterImporter
  class ImporterTest < ActiveSupport::TestCase
    FakeFile = Struct.new(:original_filename, :content, :size) do
      def read = content
    end

    test "runs full pipeline returning chapters" do
      file = FakeFile.new("livro.txt", "Capítulo 1\n\nPrimeiro.\n\nCapítulo 2\n\nSegundo.", 0)
      file.size = file.content.bytesize

      result = Importer.import(file: file, book: books(:draft_book))

      assert_equal 2, result.chapters.size
      assert_equal "Capítulo 1", result.chapters.first.title
      refute result.empty?
    end

    test "returns empty result when no chapters detected" do
      file = FakeFile.new("livro.txt", "Texto sem estrutura de capítulos.", 0)
      file.size = file.content.bytesize

      result = Importer.import(file: file)

      assert result.empty?
    end

    test "raises error for invalid file" do
      file = FakeFile.new("livro.exe", "MZ binary", 9)

      assert_raises(Error) do
        Importer.import(file: file)
      end
    end
  end
end
