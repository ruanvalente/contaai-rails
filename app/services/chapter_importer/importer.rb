# frozen_string_literal: true

module ChapterImporter
  class Importer
    MAX_CHAPTERS = 200

    Result = Struct.new(:chapters, keyword_init: true) do
      def empty? = chapters.empty?
    end

    class << self
      def import(file:, book: nil)
        text = TextParser.parse!(file)
        chapters = ChapterDetector.detect(text)

        if chapters.size > MAX_CHAPTERS
          raise Error, "Muitos capítulos detectados (#{chapters.size}). O limite é #{MAX_CHAPTERS}."
        end

        Result.new(chapters: chapters)
      end
    end
  end
end
