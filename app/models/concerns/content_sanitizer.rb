module ContentSanitizer
  extend ActiveSupport::Concern

  ALLOWED_TAGS = %w[
    h1 h2 h3 h4 h5 h6
    p strong em u s
    ul ol li
    blockquote
    a
    code pre
    hr br
  ].freeze

  ALLOWED_ATTRIBUTES = %w[
    href title target rel align
  ].freeze

  ALLOWED_PROTOCOLS = %w[http https mailto].freeze

  included do
    before_save :sanitize_content, if: :content_changed?
  end

  def self.sanitize(html)
    return html if html.blank?

    sanitized = Rails::HTML5::SafeListSanitizer.new.sanitize(
      html,
      tags: ALLOWED_TAGS,
      attributes: ALLOWED_ATTRIBUTES,
      protocols: ALLOWED_PROTOCOLS
    )

    sanitized = validate_urls!(sanitized) if sanitized.present?
    sanitized
  end

  def self.validate_urls!(html)
    return html if html.blank?

    doc = Nokogiri::HTML::DocumentFragment.parse(html)
    doc.css("a[href]").each do |link|
      href = link["href"]
      next if href.blank?

      begin
        uri = URI.parse(href)
        unless ALLOWED_PROTOCOLS.include?(uri.scheme)
          link.remove_attribute("href")
        end
      rescue URI::InvalidURIError
        link.remove_attribute("href")
      end
    end
    doc.to_html
  end

  private

  def sanitize_content
    self.content = ContentSanitizer.sanitize(content) if content.present?
  end
end
